class HunterState < ApplicationRecord
  self.table_name = "hunter_state"
  EMPTY = { "selected" => [], "completed" => [], "answers" => [], "session" => nil }.freeze
  def self.current
    find_or_create_by!(id: 1) { |row| row.data = EMPTY }
  end
end
