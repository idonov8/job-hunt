Rails.application.routes.draw do
  root "jobs#index"
  get "/login", to: "sessions#new"
  post "/login", to: "sessions#create"
  delete "/logout", to: "sessions#destroy"
  get "/tracker", to: redirect("/")
  get "/scan", to: "scan#show"

  namespace :api, defaults: { format: :json } do
    get "openapi.json", to: "openapi#show"
    resources :jobs, param: :slug, only: %i[index show create update destroy] do
      post :index_form, path: "index", on: :member
    end
    resources :targets, only: %i[index create update destroy]
    resources :outreach, only: %i[index create update destroy]
    resources :playbook, only: %i[index create update destroy]
    resource :meta, only: %i[show create], controller: "meta"
    resource :hunter, only: %i[show create], controller: "hunter"
  end
  match "/mcp", to: "mcp#handle", via: %i[get post delete]
end
