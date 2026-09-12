require "net/http"
class FormIndexer
  LIMIT = 1_000_000
  def initialize(job) = @job = job
  def call
    url = @job.application_url.presence || @job.url.presence
    return @job.update!(form_index: nil) unless url
    uri = URI.parse(url)
    raise ArgumentError, "URL must use http(s) without credentials" unless %w[http https].include?(uri.scheme) && !uri.userinfo
    response = Net::HTTP.get_response(uri)
    html = response.body.byteslice(0, LIMIT)
    doc = Nokogiri::HTML(html)
    fields = doc.css("input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled])").map.with_index do |node, i|
      id = node["id"]
      label = id && doc.at_css("label[for='#{id.gsub("\x27", "")}']")&.text&.strip
      { key: node["name"].presence || id.presence || "field-#{i + 1}", label: label.presence || node["placeholder"].presence || node["name"].presence || "Field #{i + 1}", kind: node.name == "textarea" ? "textarea" : (node["type"].presence || node.name), required: node.key?("required"), options: node.css("option").map { |o| o.text.strip }.reject(&:blank?), open: node.name == "textarea" }
    end
    minutes = fields.empty? ? nil : [ (1 + fields.length * 0.25 + fields.count { |f| f[:open] } * 2.25).ceil, 1 ].max
    @job.update!(form_index: { status: fields.empty? ? "unknown" : "partial", url: url, indexed_at: Time.current.iso8601, fields: fields, minutes: minutes, note: "Static HTML index; dynamic, conditional, and multi-step fields may be missing." })
  rescue StandardError => error
    @job.update!(form_index: { status: "unknown", url: url, indexed_at: Time.current.iso8601, fields: [], minutes: nil, note: "Could not index form: #{error.class}" })
  end
end
