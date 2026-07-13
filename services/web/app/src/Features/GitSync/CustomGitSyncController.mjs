import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import DocumentUpdaterHandler from '../DocumentUpdater/DocumentUpdaterHandler.mjs'
import ProjectZipStreamManager from '../Downloads/ProjectZipStreamManager.mjs'
import FileSystemImportManager from '../Uploads/FileSystemImportManager.mjs'
import ProjectGetter from '../Project/ProjectGetter.mjs'
import SessionManager from '../Authentication/SessionManager.mjs'
import ChatApiHandler from '../Chat/ChatApiHandler.mjs'
import ProjectEntityHandler from '../Project/ProjectEntityHandler.mjs'
import UserGetter from '../User/UserGetter.mjs'

const execAsync = promisify(exec)
const GIT_SYNC_DIR = '/var/lib/overleaf/data/custom-git-sync'

async function execAsyncLogged(cmd) {
  try {
    const { stdout, stderr } = await execAsync(cmd)
    console.log(`[GIT CMD SUCCESS] ${cmd.replace(/https:\/\/[^@]+@/g, 'https://***@')}\nSTDOUT: ${stdout}\nSTDERR: ${stderr}`)
    return { stdout, stderr }
  } catch (err) {
    console.error(`[GIT CMD ERROR] ${cmd.replace(/https:\/\/[^@]+@/g, 'https://***@')}\nSTDOUT: ${err.stdout}\nSTDERR: ${err.stderr}`)
    throw err
  }
}

function getAuthUrl(remoteUrl, token) {
  try {
    const url = new URL(remoteUrl)
    url.username = token
    return url.toString()
  } catch (e) {
    return remoteUrl
  }
}

async function flushProject(projectId) {
  return new Promise((resolve, reject) => {
    DocumentUpdaterHandler.flushProjectToMongo(projectId, (err) => {
      if (err) return reject(err)
      resolve()
    })
  })
}

async function getProject(projectId) {
  return new Promise((resolve, reject) => {
    ProjectGetter.getProject(projectId, { name: true, rootFolder: true, 'overleaf.history.id': true }, (err, project) => {
      if (err) return reject(err)
      resolve(project)
    })
  })
}

async function createZipFile(projectId, historyId, outputPath) {
  return new Promise((resolve, reject) => {
    ProjectZipStreamManager.createZipStreamForProject(
      projectId,
      false,
      historyId,
      (err, stream) => {
        if (err) return reject(err)
        const writeStream = fs.createWriteStream(outputPath)
        stream.pipe(writeStream)
        writeStream.on('finish', resolve)
        writeStream.on('error', reject)
      }
    )
  })
}

async function exportComments(projectId, exportPath) {
  try {
    const docs = await ProjectEntityHandler.promises.getAllDocs(projectId)
    const threads = await ChatApiHandler.promises.getThreads(projectId)
    const resolvedThreadIds = await ChatApiHandler.promises.getResolvedThreadIds(projectId)
    
    const resolvedThreadSet = new Set(resolvedThreadIds)

    // Collect all unique user IDs to fetch them at once
    const userIds = new Set()
    for (const threadId of Object.keys(threads || {})) {
      const messages = threads[threadId].messages || []
      for (const msg of messages) {
        if (msg.user_id) userIds.add(msg.user_id)
      }
    }

    const userEmails = {}
    for (const userId of userIds) {
      try {
        const user = await UserGetter.promises.getUser(userId, { email: 1 })
        if (user && user.email) {
          userEmails[userId] = user.email
        }
      } catch (e) {
        console.warn('Error fetching user', userId, e)
      }
    }

    const exportedComments = []

    for (const docPath of Object.keys(docs)) {
      const doc = docs[docPath]
      const { lines, ranges } = await ProjectEntityHandler.promises.getDoc(projectId, doc._id)
      
      if (!ranges || !ranges.comments || ranges.comments.length === 0) continue

      // We need to map character positions to lines
      // Create an array of cumulative character counts for each line
      const lineLengths = lines.map(l => l.length + 1) // +1 for the newline character
      
      for (const comment of ranges.comments) {
        const pos = comment.op.p
        let currentPos = 0
        let lineNumber = 1
        
        for (const len of lineLengths) {
          if (currentPos + len > pos) {
            break
          }
          currentPos += len
          lineNumber++
        }

        const threadIdStr = comment.op.t.toString()
        const thread = threads[threadIdStr]
        const messages = []

        if (thread && thread.messages) {
          for (const msg of thread.messages) {
            messages.push({
              author: userEmails[msg.user_id] || msg.user_id,
              content: msg.content,
              timestamp: msg.timestamp
            })
          }
        }

        exportedComments.push({
          file: docPath.replace(/^\//, ''), // remove leading slash
          line: lineNumber,
          highlightedText: comment.op.c,
          threadId: threadIdStr,
          resolved: resolvedThreadSet.has(threadIdStr),
          messages
        })
      }
    }

    const exportData = {
      exportedAt: new Date().toISOString(),
      projectId,
      comments: exportedComments
    }

    await fs.promises.writeFile(exportPath, JSON.stringify(exportData, null, 2))
    console.log(`[GIT PUSH] Exported ${exportedComments.length} comments to ${exportPath}`)
  } catch (err) {
    console.error(`[GIT PUSH] Error exporting comments for ${projectId}:`, err)
  }
}

export async function pushToGit(req, res, next) {
    try {
      const projectId = req.params.Project_id
      const { remoteUrl, token } = req.body
      if (!remoteUrl || !token) return res.status(400).send('Missing URL or token')

      const projectDir = path.join(GIT_SYNC_DIR, projectId)
      const zipPath = path.join('/tmp', `git-sync-${projectId}.zip`)
      const authUrl = getAuthUrl(remoteUrl, token)

      await fs.promises.mkdir(projectDir, { recursive: true })
      await flushProject(projectId)
      const project = await getProject(projectId)
      await createZipFile(projectId, project.overleaf?.history?.id, zipPath)

      // Initialize git if not present
      const gitDirExists = fs.existsSync(path.join(projectDir, '.git'))
      if (!gitDirExists) {
        await execAsyncLogged(`git clone ${authUrl} ${projectDir}`)
      }

      // Extract zip over the directory (using unzip), keeping .git intact
      // Delete everything except .git
      await execAsyncLogged(`find ${projectDir} -mindepth 1 -not -regex "^${projectDir}/\\.git.*" -delete`)
      await execAsyncLogged(`unzip -o ${zipPath} -d ${projectDir}`)

      // Export comments to .overleaf-comments.json
      await exportComments(projectId, path.join(projectDir, '.overleaf-comments.json'))

      // Commit and push
      await execAsyncLogged(`git -C ${projectDir} add .`)
      try {
        await execAsyncLogged(`git -c user.name="Overleaf Sync" -c user.email="sync@overleaf.local" -C ${projectDir} commit -m "Update from Overleaf"`)
      } catch (e) {
        console.log("Commit skipped, possibly no changes:", e.message)
      }
      
      // push
      const pushCmd = `git -C ${projectDir} push ${authUrl} HEAD:main`
      await execAsyncLogged(pushCmd)

      // Cleanup zip
      await fs.promises.unlink(zipPath)

      res.status(200).json({ success: true })
    } catch (err) {
      console.error('Error in custom push to git:', err)
      res.status(500).json({ error: err.message })
    }
}

export async function pullFromGit(req, res, next) {
    try {
      const userId = SessionManager.getLoggedInUserId(req.session)
      const projectId = req.params.Project_id
      const { remoteUrl, token } = req.body
      if (!remoteUrl || !token) return res.status(400).send('Missing URL or token')

      const projectDir = path.join(GIT_SYNC_DIR, projectId)
      const authUrl = getAuthUrl(remoteUrl, token)

      await fs.promises.mkdir(projectDir, { recursive: true })
      
      // Clone if needed
      const gitDirExists = fs.existsSync(path.join(projectDir, '.git'))
      if (!gitDirExists) {
        await execAsyncLogged(`git clone ${authUrl} ${projectDir}`)
      } else {
        // Fetch and merge
        try {
          await execAsyncLogged(`git -C ${projectDir} pull ${authUrl} main`)
        } catch(e) {
          console.warn("Merge conflicts or errors:", e)
          // we continue, the files with conflict markers will be synced
        }
      }

      // Sync the pulled files back to overleaf
      const project = await getProject(projectId)
      const rootFolderId = project.rootFolder[0]._id

      // We need to add the files into Overleaf, replace=true
      // But we shouldn't add .git folder
      const tempSyncDir = path.join('/tmp', `sync-to-ol-${projectId}`)
      await execAsyncLogged(`rm -rf ${tempSyncDir}`)
      await execAsyncLogged(`cp -r ${projectDir} ${tempSyncDir}`)
      await execAsyncLogged(`rm -rf ${tempSyncDir}/.git`)

      // Iterate over directory entries and add each via the exported addEntity API
      const entries = await fs.promises.readdir(tempSyncDir)
      console.log(`[GIT PULL] Syncing ${entries.length} entries to Overleaf project ${projectId}`)
      for (const entry of entries) {
        if (entry.startsWith('.')) continue // skip hidden files
        const entryPath = path.join(tempSyncDir, entry)
        try {
          await FileSystemImportManager.promises.addEntity(userId, projectId, rootFolderId, entry, entryPath, true)
          console.log(`[GIT PULL] Successfully synced: ${entry}`)
        } catch (entityErr) {
          console.error(`[GIT PULL] Error syncing entity ${entry}:`, entityErr.message)
        }
      }

      await execAsyncLogged(`rm -rf ${tempSyncDir}`)

      res.status(200).json({ success: true })
    } catch (err) {
      console.error('Error in custom pull from git:', err)
      res.status(500).json({ error: err.message })
    }
}
