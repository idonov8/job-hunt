class JobsController < ApplicationController
  before_action :require_browser_auth
  def index
    @jobs = Job.ordered
    @hunter = HunterState.current.data
    @scan = Scan.order(scanned_on: :desc, id: :desc).first
  end
end
