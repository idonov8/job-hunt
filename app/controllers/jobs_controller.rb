class JobsController < ApplicationController
  before_action :require_browser_auth
  def index
    @jobs = Job.ordered
    @hunter = HunterState.current.data
    @xp = @hunter["completed"].sum { |item| item["xp"] || 100 }
    @level = @xp / 500 + 1
    @scan = Scan.order(scanned_on: :desc, id: :desc).first
  end
end
