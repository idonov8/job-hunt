module ApiAuthentication
  extend ActiveSupport::Concern

  included do
    before_action :require_api_auth
    protect_from_forgery with: :exception, unless: :agent_token?
  end

  private
    def agent_token?
      token = request.authorization&.delete_prefix("Bearer ")
      agent = ENV["AGENT_TOKEN"]
      agent.present? && token.present? && ActiveSupport::SecurityUtils.secure_compare(token, agent)
    end

    def require_api_auth
      return if agent_token? || session[:authenticated]

      render json: { error: "unauthorized", hint: "Send Authorization: Bearer <AGENT_TOKEN>, or sign in at /login. See /api/openapi.json." }, status: :unauthorized
    end
end
