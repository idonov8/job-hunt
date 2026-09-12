class Api::MetaController < Api::BaseController
  def show
    latest = Scan.order(scanned_on: :desc, id: :desc).first
    render json: { jobs: { total: Job.count, fresh: Job.where(fresh: true).count, applied: Job.where.not(status: "").count }, latest_scan: latest }
  end
  def create
    scan = Scan.create!(json_body.slice("scanned_on", "sources", "jobs_added", "summary"))
    render json: { scan: scan }, status: :created
  end
end
