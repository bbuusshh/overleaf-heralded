import mongoose from 'mongoose'
import Settings from '/home/vlad/GIT/overleaf-heralded/services/web/config/settings.defaults.js'
import ProjectGetter from '/home/vlad/GIT/overleaf-heralded/services/web/app/src/Features/Project/ProjectGetter.mjs'
import DocumentUpdaterHandler from '/home/vlad/GIT/overleaf-heralded/services/web/app/src/Features/DocumentUpdater/DocumentUpdaterHandler.mjs'

mongoose.connect(Settings.mongo.url)
ProjectGetter.getProject('6a54b857417f6635f1562e12', { name: true, rootFolder: true }, async (err, project) => {
  const supp = project.rootFolder[0].docs.find(d => d.name === 'supplementary.tex')
  if (supp) {
    const doc = await DocumentUpdaterHandler.promises.getDocument('6a54b857417f6635f1562e12', supp._id)
    console.log("Lines of supplementary.tex:")
    console.log(doc.lines.slice(0, 10).join('\n'))
  } else {
    console.log("supplementary.tex not found")
  }
  process.exit(0)
})
