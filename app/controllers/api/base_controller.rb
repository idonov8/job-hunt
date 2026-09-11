class Api::BaseController < ApplicationController
  include ApiAuthentication
  private
    def json_body
      request.request_parameters.presence || JSON.parse(request.raw_post.presence || "{}")
    rescue JSON::ParserError
      raise ActionController::BadRequest, "body must be valid JSON"
    end
end
