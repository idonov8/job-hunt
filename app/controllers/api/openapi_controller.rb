class Api::OpenapiController < ApplicationController
  def show
    render json: {
      openapi: "3.1.0", info: { title: "Job Hunter API", version: "2.0.0" },
      components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } } },
      security: [ { bearerAuth: [] } ],
      paths: {
        "/api/jobs" => { get: { summary: "List and filter jobs" }, post: { summary: "Add a job; company and role are required" } },
        "/api/jobs/{slug}" => { get: { summary: "Get a job" }, patch: { summary: "Update writable job fields" }, delete: { summary: "Delete a job" } },
        "/api/jobs/{slug}/index" => { post: { summary: "Re-index the application form" } },
        "/api/meta" => { get: { summary: "Counters and latest scan" }, post: { summary: "Record a scan" } },
        "/api/hunter" => { get: { summary: "Get personal Job Hunt state" }, post: { summary: "Transition Job Hunt" } }
      },
      "x-writable-job-fields": Job::WRITABLE
    }
  end
end
