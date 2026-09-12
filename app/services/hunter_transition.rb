class HunterTransition
  DEFAULT_FORECAST_MINUTES = 5
  BASE_XP = 100
  MIN_XP = 50
  MAX_XP = 125

  attr_reader :awarded_xp

  def self.total_xp(state)
    Array(state["completed"]).sum { |entry| entry["xp"].presence || BASE_XP }
  end

  def initialize(state, action, jobs, now: Time.current)
    @state = state.deep_stringify_keys.deep_dup
    @action = action.deep_stringify_keys
    @jobs = jobs
    @now = now
    @awarded_xp = 0
  end

  def call
    @state["selected"] ||= []
    @state["completed"] ||= []
    @state["answers"] ||= []
    type, slug = @action.values_at("type", "slug")
    case type
    when "select"
      raise ArgumentError, "Choose a job" if slug.blank?
      @state["selected"] << slug unless @state["selected"].include?(slug)
    when "remove" then @state["selected"].delete(slug)
    when "start"
      raise ArgumentError, "Resume or end the current Job Hunt first" if @state["session"] && !@state["session"]["ended"]
      raise ArgumentError, "Select at least one job" if @state["selected"].empty?
      @state["session"] = { "queue" => @state["selected"].dup, "skipped" => [], "done" => [], "ended" => false, "started_at" => timestamp, "current_started_at" => timestamp }
    when "end" then @state["session"]["ended"] = true if @state["session"]
    when "skip", "complete", "pass" then advance(type, slug)
    else raise ArgumentError, "Unknown Job Hunt action"
    end
    @state
  end
  private
    def advance(type, slug)
      session = @state["session"]
      raise ArgumentError, "This application is no longer current; reload Job Hunt" unless session && !session["ended"] && session["queue"].first == slug

      if type == "skip"
        raise ArgumentError, "No skips left. Finish this application or end Job Hunt." if session["skipped"].length >= 2
        session["skipped"] << slug
      else
        job = @jobs.fetch(slug)
        already_awarded = @state["completed"].any? { |item| item["slug"] == slug }
        @awarded_xp = awarded_for(type, session, job) unless already_awarded
        session["done"] << slug
        @state["completed"] << { "slug" => slug, "at" => timestamp, "action" => type, "xp" => @awarded_xp } unless already_awarded
        @state["selected"].delete(slug)
        save_answers(slug, job) if type == "complete"
      end
      session["queue"].shift
      session["ended"] = session["queue"].empty?
      session["current_started_at"] = session["ended"] ? nil : timestamp
    end

    def awarded_for(type, session, job)
      expected_seconds = forecast_minutes(job) * 60
      started_at = Time.iso8601(session["current_started_at"].to_s)
      elapsed_seconds = [ @now - started_at, 1 ].max
      completion_xp = [ [ (BASE_XP * expected_seconds / elapsed_seconds).round, MIN_XP ].max, MAX_XP ].min
      type == "pass" ? (completion_xp / 3.0).round : completion_xp
    rescue ArgumentError
      type == "pass" ? (BASE_XP / 3.0).round : BASE_XP
    end

    def forecast_minutes(job)
      minutes = job.form_index.to_h["minutes"].to_f
      minutes.positive? ? minutes : DEFAULT_FORECAST_MINUTES
    end

    def save_answers(slug, job)
      Array(@action["answers"]).each do |answer|
        next if answer["question"].blank? || answer["answer"].blank?

        @state["answers"] << answer.slice("question", "answer").merge("slug" => slug, "company" => job.company, "saved_at" => timestamp)
      end
    end

    def timestamp = @now.iso8601
end
