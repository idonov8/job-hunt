class HunterTransition
  def initialize(state, action, jobs)
    @state = state.deep_stringify_keys.deep_dup
    @action = action.deep_stringify_keys
    @jobs = jobs
  end
  def call
    type, slug = @action.values_at("type", "slug")
    case type
    when "select"
      raise ArgumentError, "Choose a job" if slug.blank?
      @state["selected"] << slug unless @state["selected"].include?(slug)
    when "remove" then @state["selected"].delete(slug)
    when "start"
      raise ArgumentError, "Resume or end the current session first" if @state["session"] && !@state["session"]["ended"]
      raise ArgumentError, "Select at least one job" if @state["selected"].empty?
      @state["session"] = { "queue" => @state["selected"].dup, "skipped" => [], "done" => [], "ended" => false }
    when "end" then @state["session"]["ended"] = true if @state["session"]
    when "skip", "complete" then advance(type, slug)
    else raise ArgumentError, "Unknown action"
    end
    @state
  end
  private
    def advance(type, slug)
      return if type == "complete" && @state["completed"].any? { |item| item["slug"] == slug }
      session = @state["session"]
      raise ArgumentError, "This application is no longer current; reload the session" unless session && !session["ended"] && session["queue"].first == slug
      if type == "skip"
        raise ArgumentError, "No skips left. Finish this application or end the session." if session["skipped"].length >= 2
        session["skipped"] << slug
      else
        now = Time.current.iso8601
        session["done"] << slug
        @state["completed"] << { "slug" => slug, "at" => now }
        @state["selected"].delete(slug)
        job = @jobs.fetch(slug)
        Array(@action["answers"]).each do |answer|
          next if answer["question"].blank? || answer["answer"].blank?
          @state["answers"] << answer.slice("question", "answer").merge("slug" => slug, "company" => job.company, "saved_at" => now)
        end
      end
      session["queue"].shift
      session["ended"] = session["queue"].empty?
    end
end
