class Api::CollectionsController < Api::BaseController
  private
    def model = controller_name.classify.constantize
    def permitted
      case controller_name
      when "targets" then %w[group_name name description position]
      when "outreach" then %w[title body position]
      else %w[heading bullets position]
      end
    end
  public
    def index
      rows = model.order(:position, :id)
      render json: { controller_name => rows }
    end
    def create
      row = model.create!(json_body.slice(*permitted))
      render json: { controller_name.singularize => row }, status: :created
    end
    def update
      row = model.find(params[:id]); row.update!(json_body.slice(*permitted))
      render json: { controller_name.singularize => row }
    end
    def destroy
      model.find(params[:id]).destroy!
      render json: { deleted: params[:id].to_i }
    end
end
