param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId
)

gcloud config set project $ProjectId
gcloud firestore indexes composite create `
  --collection-group=chunks `
  --query-scope=COLLECTION `
  --field-config=order=ASCENDING,field-path=visibilityKey `
  --field-config=field-path=embedding,vector-config='{\"dimension\":\"1024\",\"flat\":{}}' `
  --database='(default)'
