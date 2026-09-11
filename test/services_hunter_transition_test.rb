require "test_helper"
class HunterTransitionTest < ActiveSupport::TestCase
  JobStub = Data.define(:company)
  def state
    { "selected" => [ "one" ], "completed" => [], "answers" => [], "session" => nil }
  end
  test "starts and completes a session once" do
    started = HunterTransition.new(state, { type: "start" }, {}).call
    completed = HunterTransition.new(started, { type: "complete", slug: "one", answers: [ { question: "Why?", answer: "Because." } ] }, { "one" => JobStub.new("Acme") }).call
    assert_equal [], completed["selected"]
    assert_equal "one", completed["completed"].first["slug"]
    assert_equal "Acme", completed["answers"].first["company"]
    assert completed["session"]["ended"]
  end
  test "allows no more than two skips" do
    current = { "selected" => %w[a b c], "completed" => [], "answers" => [], "session" => { "queue" => %w[a b c], "skipped" => [], "done" => [], "ended" => false } }
    current = HunterTransition.new(current, { type: "skip", slug: "a" }, {}).call
    current = HunterTransition.new(current, { type: "skip", slug: "b" }, {}).call
    assert_raises(ArgumentError) { HunterTransition.new(current, { type: "skip", slug: "c" }, {}).call }
  end
end
