# Hazards of pull_request_target

The `pull_request_target` event triggers in the context of the base repository with read/write tokens and secrets access.
Checking out the untrusted fork PR branch allows malicious pull requests to execute arbitrary code with repository write permissions.
