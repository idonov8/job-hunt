require "test_helper"

class Api::HunterControllerTest < ActionDispatch::IntegrationTest
  setup do
    ENV["AGENT_TOKEN"] = "test-token"
    HunterState.current.update!(data: HunterState::EMPTY.deep_dup, version: 0)
    @job = Job.create!(company: "Acme", role: "Engineer")
  end

  teardown do
    ENV.delete("AGENT_TOKEN")
  end

  test "passing records XP and updates the job status" do
    request_hunt(type: "select", slug: @job.slug)
    request_hunt(type: "start")
    body = request_hunt(type: "pass", slug: @job.slug)

    assert_equal "pass", @job.reload.status
    assert_equal body["state"]["completed"].first["xp"], body["awarded_xp"]
    assert_equal body["awarded_xp"], body["xp"]
    assert_equal "pass", body["state"]["completed"].first["action"]
  end

  test "updating a job status removes it from the queue" do
    request_hunt(type: "select", slug: @job.slug)
    request_hunt(type: "start")

    patch api_job_path(@job.slug), params: { status: "talking" }.to_json, headers: { "Authorization" => "Bearer test-token", "CONTENT_TYPE" => "application/json" }

    assert_response :success
    assert_empty HunterState.current.data["selected"]
    assert HunterState.current.data.dig("session", "ended")
  end

  private

    def request_hunt(payload)
      post api_hunter_path, params: payload.to_json, headers: { "Authorization" => "Bearer test-token", "CONTENT_TYPE" => "application/json" }
      assert_response :success
      JSON.parse(response.body)
    end
end
