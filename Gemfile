source "https://rubygems.org"
ruby "3.4.4"
gem "rails", "~> 8.1.3"
gem "propshaft"
gem "pg", "~> 1.5"
gem "puma", ">= 6.0"
gem "dotenv-rails"
gem "nokogiri"
gem "json", "~> 2.10"
group :development, :test do
  gem "debug", require: "debug/prelude"
  gem "brakeman", require: false
  gem "rubocop-rails-omakase", require: false
end
group :test do
  gem "rack-test"
end
