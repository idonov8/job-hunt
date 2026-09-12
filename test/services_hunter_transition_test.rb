require "test_helper"
class HunterTransitionTest < ActiveSupport::TestCase
  JobStub = Struct.new(:company, :form_index)
  def state
    { "selected" => [ "one" ], "completed" => [], "answers" => [], "session" => nil }
  end
  test "starts and completes a session once" do
    now = Time.utc(2026, 9, 12, 12)
    started = HunterTransition.new(state, { type: "start" }, {}, now: now).call
    completed = HunterTransition.new(started, { type: "complete", slug: "one", answers: [ { question: "Why?", answer: "Because." } ] }, { "one" => JobStub.new("Acme") }, now: now + 300).call
    assert_equal [], completed["selected"]
    assert_equal "one", completed["completed"].first["slug"]
    assert_equal 100, completed["completed"].first["xp"]
    assert_equal "Acme", completed["answers"].first["company"]
    assert completed["session"]["ended"]
  end

  test "uses the indexed forecast, bounds completion XP, and keeps legacy awards" do
    now = Time.utc(2026, 9, 12, 12)
    started = HunterTransition.new(state, { type: "start" }, {}, now: now).call
    transition = HunterTransition.new(started, { type: "complete", slug: "one" }, { "one" => JobStub.new("Acme", { "minutes" => 10 }) }, now: now + 300)
    completed = transition.call

    assert_equal 125, transition.awarded_xp
    assert_equal 225, HunterTransition.total_xp(completed.merge("completed" => [ { "slug" => "old" } ] + completed["completed"]))
  end

  test "passing advances the queue and awards a third" do
    now = Time.utc(2026, 9, 12, 12)
    queued = state.merge("selected" => %w[one two])
    started = HunterTransition.new(queued, { type: "start" }, {}, now: now).call
    pass = HunterTransition.new(started, { type: "pass", slug: "one" }, { "one" => JobStub.new("Acme") }, now: now + 300)
    passed = pass.call

    assert_equal 33, pass.awarded_xp
    assert_equal [ "two" ], passed["selected"]
    assert_equal "two", passed.dig("session", "queue", 0)
    assert_equal (now + 300).iso8601, passed.dig("session", "current_started_at")
    assert_equal "pass", passed["completed"].first["action"]
  end

  test "requeued jobs advance without a second XP award" do
    now = Time.utc(2026, 9, 12, 12)
    requeued = state.merge(
      "completed" => [ { "slug" => "one", "xp" => 100 } ],
      "session" => { "queue" => [ "one" ], "skipped" => [], "done" => [], "ended" => false, "current_started_at" => now.iso8601 }
    )
    transition = HunterTransition.new(requeued, { type: "complete", slug: "one", answers: [ { question: "Why?", answer: "Again." } ] }, { "one" => JobStub.new("Acme") }, now: now + 300)
    completed = transition.call

    assert_equal 0, transition.awarded_xp
    assert_equal [], completed["selected"]
    assert completed.dig("session", "ended")
    assert_equal 1, completed["completed"].length
    assert_equal 100, HunterTransition.total_xp(completed)
    assert_equal "Again.", completed["answers"].first["answer"]
  end
  test "allows no more than two skips" do
    current = { "selected" => %w[a b c], "completed" => [], "answers" => [], "session" => { "queue" => %w[a b c], "skipped" => [], "done" => [], "ended" => false } }
    current = HunterTransition.new(current, { type: "skip", slug: "a" }, {}).call
    current = HunterTransition.new(current, { type: "skip", slug: "b" }, {}).call
    assert_raises(ArgumentError) { HunterTransition.new(current, { type: "skip", slug: "c" }, {}).call }
  end
end
