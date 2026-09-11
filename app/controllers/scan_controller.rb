class ScanController < ApplicationController
  before_action :require_browser_auth
  def show
    @endpoint = "#{request.base_url}/mcp"
  end
end
