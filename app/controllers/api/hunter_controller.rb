class Api::HunterController < Api::BaseController
  def show
    render json: payload(HunterState.current)
  end
  def create
    row = HunterState.current
    awarded_xp = 0
    row.with_lock do
      jobs = Job.where(slug: row.data["selected"] | [ json_body["slug"] ].compact).index_by(&:slug)
      transition = HunterTransition.new(row.data, json_body, jobs)
      row.data = transition.call
      row.version += 1
      case json_body["type"]
      when "complete"
        jobs.fetch(json_body["slug"]).update!(status: "applied")
      when "pass"
        jobs.fetch(json_body["slug"]).update!(status: "pass")
      end
      row.save!
      awarded_xp = transition.awarded_xp
    end
    render json: payload(row, awarded_xp: awarded_xp)
  rescue ArgumentError, KeyError => error
    render json: { error: "invalid", message: error.message }, status: :conflict
  end
  private
    def payload(row, awarded_xp: 0)
      xp = HunterTransition.total_xp(row.data)
      { state: row.data, version: row.version, xp: xp, level: xp / 500 + 1, awarded_xp: awarded_xp }
    end
end
