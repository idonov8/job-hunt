class McpController < ApplicationController
  include ApiAuthentication
  def handle
    return head :method_not_allowed unless request.post?
    body = JSON.parse(request.raw_post)
    id, method = body.values_at("id", "method")
    result = case method
    when "initialize" then { protocolVersion: "2025-03-26", capabilities: { tools: {}, prompts: {} }, serverInfo: { name: "job-hunter", version: "2.0.0" } }
    when "notifications/initialized" then return head :accepted
    when "tools/list" then { tools: tools }
    when "prompts/list" then { prompts: [ { name: "job_scan", description: "Run a verified personalized job scan", arguments: [ { name: "preferences", required: true }, { name: "cadence", required: false } ] } ] }
    when "prompts/get" then { description: "Verified job scan", messages: [ { role: "user", content: { type: "text", text: scan_prompt(body.dig("params", "arguments") || {}) } } ] }
    when "tools/call" then call_tool(body.dig("params", "name"), body.dig("params", "arguments") || {})
    else return render(json: { jsonrpc: "2.0", id: id, error: { code: -32601, message: "Method not found" } })
    end
    render json: { jsonrpc: "2.0", id: id, result: result }
  rescue JSON::ParserError
    render json: { jsonrpc: "2.0", id: nil, error: { code: -32700, message: "Parse error" } }, status: :bad_request
  end
  private
    def tools
      %w[get_job_fields list_jobs add_job update_job index_form record_scan].map { |name| { name: name, description: name.tr("_", " ").capitalize, inputSchema: { type: "object", additionalProperties: true } } }
    end
    def call_tool(name, args)
      value = case name
      when "get_job_fields" then { writable: Job::WRITABLE, statuses: Job::STATUSES }
      when "list_jobs" then { jobs: Job.filtered(args).map(&:api_json) }
      when "add_job" then Job.create!(args.slice(*Job::WRITABLE)).tap { |job| FormIndexer.new(job).call }.reload.api_json
      when "update_job" then Job.find_by!(slug: args.delete("slug")).tap { |job| reindex = args.keys.intersect?(%w[url application_url]); job.update!(args.slice(*Job::WRITABLE)); FormIndexer.new(job).call if reindex }.reload.api_json
      when "index_form" then Job.find_by!(slug: args["slug"]).tap { |j| FormIndexer.new(j).call }.reload.api_json
      when "record_scan" then Scan.create!(args.slice("scanned_on", "sources", "jobs_added", "summary"))
      else raise ArgumentError, "Unknown tool"
      end
      { content: [ { type: "text", text: value.to_json } ] }
    rescue StandardError => error
      { isError: true, content: [ { type: "text", text: error.message } ] }
    end
    def scan_prompt(args)
      "Run a #{args['cadence'].presence || 'weekly'} job scan for: #{args['preferences']}. Call get_job_fields first. Verify company, role, posting and application URLs. Preserve notes, statuses, and history; never guess form counts or user-confirmed completion. Add only genuine new matches and record the scan."
    end
end
