import db from './services/web/app/src/infrastructure/mongodb.mjs'
import ProjectEditorHandler from './services/web/app/src/Features/Project/ProjectEditorHandler.mjs'

async function run() {
  await db.init()
  const project = await db.models.Project.findOne()
  if (!project) {
    console.log("No project found!")
    process.exit(0)
  }
  const user = await db.models.User.findOne({_id: project.owner_ref})
  const res = ProjectEditorHandler.buildProjectModelView(project, {user}, [], [], false)
  console.log(JSON.stringify(res.features, null, 2))
  process.exit(0)
}
run().catch(console.error)
