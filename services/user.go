package services

type UserService struct{}

func NewUserService() *UserService {
	return &UserService{}
}

func (s *UserService) Startup() StartupConfig {
	return startupConfig("user", false)
}
