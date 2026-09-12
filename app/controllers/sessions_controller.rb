class SessionsController < ApplicationController
  def new
    redirect_to root_path if current_session?
  end
  def create
    expected = ENV["APP_PASSWORD"].to_s
    if expected.present? && ActiveSupport::SecurityUtils.secure_compare(params[:password].to_s, expected)
      reset_session
      session[:authenticated] = true
      redirect_to root_path
    else
      flash.now[:alert] = "That password is not correct."
      render :new, status: :unprocessable_entity
    end
  end
  def destroy
    reset_session
    redirect_to login_path
  end
end
