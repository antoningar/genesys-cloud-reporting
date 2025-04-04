# Genesys Cloud Custom Exporter
Ceci est un exemple d'implémentation d'un export planifié entierement customisable.  
À l'image des exports planifiés disponible nativement, cet exemple n'utilise aucune autre ressource que celles disponible sur Genesys Cloud.  
Les [Genesys function](https://developer.genesys.cloud/blog/2025-01-14-genesys-functions/) permettent de récupérer n'importe quelles données et de les formatter librement.  
Ici ce sont les datas actions en erreur, les déconnexions dues aux erreures de flow et les interactions de courte durées qui sont récupérées.  

![](docs/schedule-exporter.png)

## Function
1. install dependencies  
```npm install```
2. zip everything  
```zip a -r exporter.zip ./*```

## Terraform
Le dossier terraform contient la déclaration de tous les éléments necessaire pour le déploiement d'une telle solution.  
Seul l'oauth que va utiliser terraform et son rôle associé sont a créer manuellement.  

### OAUTH
Pour les déploiement terraform, l'oauth doit avoir un role avec à minima les permissions suivantes:  
`to be added`  

L'id et le secret de cet oauth doivent être renseignés dans un fichier local suivant cette structure:  
`oauthclient_id = ""`  
`oauthclient_secret = ""`  
`aws_region = "eu-west-1"`  

Les commandes `plan` et `apply` devront être lancées avec l'option `var-file=local.tfvars`
