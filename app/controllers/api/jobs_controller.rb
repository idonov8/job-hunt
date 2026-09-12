class Api::JobsController < Api::BaseController
  before_action :find_job, only: %i[show update destroy index_form]
  rescue_from ActiveRecord::RecordInvalid, with: :invalid
  rescue_from ActiveRecord::RecordNotUnique, with: :conflict

  def index
    jobs = Job.filtered(params).map(&:api_json)
    render json: { count: jobs.length, jobs: jobs }
  end
  def show = render(json: { job: @job.api_json })
  def create
    attrs = writable_params
    return render(json: { error: '"company" and "role" are required' }, status: :bad_request) unless attrs["company"].present? && attrs["role"].present?
    job = Job.new(attrs)
    job.slug = json_body["slug"].presence
    job.save!
    FormIndexer.new(job).call
    render json: { job: job.reload.api_json }, status: :created
  end
  def update
    attrs = writable_params
    reindex = (attrs.keys & %w[url application_url]).any?
    if attrs["status"].present?
      row = HunterState.current
      row.with_lock do
        @job.update!(attrs)
        remove_from_hunt(row)
      end
    else
      @job.update!(attrs)
    end
    FormIndexer.new(@job).call if reindex
    render json: { job: @job.reload.api_json }
  end
  def destroy
    @job.destroy!
    render json: { deleted: @job.slug }
  end
  def index_form
    FormIndexer.new(@job).call
    render json: { job: @job.reload.api_json }
  end

  private
    def find_job
      @job = Job.find_by!(slug: params[:slug])
    rescue ActiveRecord::RecordNotFound
      render json: { error: "not_found", message: "no job with slug \"#{params[:slug]}\"" }, status: :not_found
    end
    def writable_params
      json_body.slice(*Job::WRITABLE)
    end
    def remove_from_hunt(row)
      queued = Array(row.data["selected"]).include?(@job.slug) || Array(row.data.dig("session", "queue")).include?(@job.slug)
      row.update!(data: HunterTransition.new(row.data, { type: "remove", slug: @job.slug }, {}).call, version: row.version + 1) if queued
    end
    def invalid(error)
      render json: { error: "invalid", message: error.record.errors.full_messages.join(", ") }, status: :bad_request
    end
    def conflict
      render json: { error: "conflict", message: "a job with that slug already exists — PATCH it instead" }, status: :conflict
    end
end
