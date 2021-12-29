```
npx sls invoke --function ec2lifecycle --data='{"action":"stop", "filters":[{"Name":"tag:application", "Values":["k8s"]}]}'
```
