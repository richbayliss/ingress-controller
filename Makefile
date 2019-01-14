PHONY: icp builder image shell logs test-certs

icp:
	cd ingress-controller-parser; tsc -b

builder:
	cd config-builder; tsc -b

image:
	docker-compose build

shell:
	docker-compose up -d
	docker-compose exec ingress-controller bash

logs:
	docker-compose up -d
	docker-compose exec ingress-controller bash -c "supervisorctl tail -f ingress-cert-agent"

test-certs:
	cat ./ingress-controller.yml | config-builder/bin/run cert-agent -o ./certs --onReady="ls -la"
	