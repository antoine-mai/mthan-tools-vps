package limits

import (
	"encoding/json"
	"net/http"

	"mthan/vps/services"
)

func Handler(sessions *services.SessionService, limitsSvc *services.UserLimitsService, cronSvc *services.CronTaskService, containerSvc *services.ContainerService) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		session, ok := sessions.GetUserSession(r)
		if !ok || session.Username == "" {
			http.Error(w, "session invalid", http.StatusUnauthorized)
			return
		}

		username := session.Username
		limits, err := limitsSvc.Get(username)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// Count current tasks
		tasks, _ := cronSvc.List(username)
		taskCount := len(tasks)

		// Count current containers
		containers := containerSvc.ListCurrentUser(username)
		containerCount := len(containers)

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"username":          username,
			"maxTasks":          limits.MaxTasks,
			"maxContainers":     limits.MaxContainers,
			"currentTasks":      taskCount,
			"currentContainers": containerCount,
		})
	})
}
