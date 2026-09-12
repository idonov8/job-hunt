class Job < ApplicationRecord
  STATUSES = [ "", "applied", "talking", "offer", "pass" ].freeze
  WRITABLE = %w[company role url application_url company_summary connection_note city employment remote top_fit impact fresh tags fit_note status my_notes source first_seen last_seen].freeze

  validates :slug, :company, :role, presence: true
  validates :slug, uniqueness: true
  validates :status, inclusion: { in: STATUSES }
  before_validation :assign_slug, on: :create
  scope :ordered, -> { order(Arel.sql("CASE WHEN jsonb_typeof(form_index->'minutes') = 'number' THEN (form_index->>'minutes')::integer END ASC NULLS LAST, fresh DESC, top_fit DESC, company ASC, role ASC")) }

  def self.filtered(params)
    jobs = ordered
    %w[status city employment].each { |key| jobs = jobs.where(key => params[key]) if params.key?(key) }
    %w[top_fit impact fresh].each { |key| jobs = jobs.where(key => true) if ActiveModel::Type::Boolean.new.cast(params[key]) }
    jobs = jobs.where("remote OR city = 'Remote'") if ActiveModel::Type::Boolean.new.cast(params[:remote])
    if params[:q].present?
      q = "%#{sanitize_sql_like(params[:q])}%"
      jobs = jobs.where("concat_ws(' ', company, role, fit_note, my_notes, array_to_string(tags, ' ')) ILIKE ?", q)
    end
    jobs
  end

  def api_json
    as_json(except: %i[id created_at], methods: []).merge("first_seen" => first_seen&.iso8601, "last_seen" => last_seen&.iso8601, "updated_at" => updated_at&.iso8601)
  end

  private
    def assign_slug
      self.slug ||= [ company, role ].join("-").downcase.unicode_normalize(:nfkd).encode("ASCII", replace: "").gsub(/[^a-z0-9]+/, "-").gsub(/^-|-$/, "")
    end
end
