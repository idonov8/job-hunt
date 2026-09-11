class Api::HunterController < Api::BaseController
  def show
    render json: payload(HunterState.current)
  end
  def create
    row = HunterState.current
    row.with_lock do
      jobs = Job.where(slug: row.data["selected"] | [ json_body["slug"] ].compact).index_by(&:slug)
      row.data = HunterTransition.new(row.data, json_body, jobs).call
      row.version += 1
      if json_body["type"] == "complete"
        jobs.fetch(json_body["slug"]).update!(status: "applied")
      end
      row.save!
    end
    render json: payload(row)
  rescue ArgumentError, KeyError => error
    render json: { error: "invalid", message: error.message }, status: :conflict
  end
  private
    def payload(row)
      { state: row.data, version: row.version, xp: row.data["completed"].length * 100, level: row.data["completed"].length * 100 / 500 + 1 }
    end
end
