class ApplicationController < ActionController::Base
  allow_browser versions: :modern
  helper_method :current_session?

  private
    def current_session?
      session[:authenticated] == true
    end

    def require_browser_auth
      redirect_to login_path unless current_session?
    end
end
