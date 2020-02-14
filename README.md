# sensor-deployment-manager

Manages sensor deployments. I.e. keeps an up-to-date record of which sensors belong to which deployments, which users have access to these deployments and what platforms are the sensors hosted on.


## Deploying changes to Kubernetes on GCP

1. Commit any changes
2. Run `npm version major/minor/patch`
3. Run `npm run dockerise`. It will use the version number as the tag for the container.
4. Have kubernetes use the new version, e.g. by initiating a rolling update via the GCP web console, or updating the version number in a local YAML file and running `kubectl apply -f my-yaml-file.yaml`.