import { expressify } from '@overleaf/promise-utils'
import ChatApiHandler from '../../app/src/Features/Chat/ChatApiHandler.mjs'
import ChatManager from '../../app/src/Features/Chat/ChatManager.mjs'
import DocumentUpdaterHandler from '../../app/src/Features/DocumentUpdater/DocumentUpdaterHandler.mjs'
import SessionManager from '../../app/src/Features/Authentication/SessionManager.mjs'

async function getThreads(req, res) {
  const projectId = req.params.project_id
  const threads = await ChatApiHandler.promises.getThreads(projectId)
  await ChatManager.promises.injectUserInfoIntoThreads(threads)
  res.json(threads)
}

async function addMessage(req, res) {
  const projectId = req.params.project_id
  const threadId = req.params.thread_id
  const content = req.body.content
  const userId = SessionManager.getLoggedInUserId(req.session)

  const comment = await ChatApiHandler.promises.sendComment(
    projectId,
    threadId,
    userId,
    content
  )
  res.json(comment)
}

async function resolveThread(req, res) {
  const projectId = req.params.project_id
  const docId = req.params.doc_id
  const threadId = req.params.thread_id
  const userId = SessionManager.getLoggedInUserId(req.session)

  // First tell DocumentUpdater to resolve it in OT ranges
  await DocumentUpdaterHandler.promises.resolveThread(
    projectId,
    docId,
    threadId,
    userId
  )
  
  // Then resolve it in chat service
  await ChatApiHandler.promises.resolveThread(projectId, threadId, userId)
  
  res.sendStatus(204)
}

async function reopenThread(req, res) {
  const projectId = req.params.project_id
  const docId = req.params.doc_id
  const threadId = req.params.thread_id
  const userId = SessionManager.getLoggedInUserId(req.session)

  await DocumentUpdaterHandler.promises.reopenThread(
    projectId,
    docId,
    threadId,
    userId
  )
  
  await ChatApiHandler.promises.reopenThread(projectId, threadId)
  
  res.sendStatus(204)
}

async function deleteThread(req, res) {
  const projectId = req.params.project_id
  const docId = req.params.doc_id
  const threadId = req.params.thread_id

  await DocumentUpdaterHandler.promises.deleteThread(
    projectId,
    docId,
    threadId
  )
  
  await ChatApiHandler.promises.deleteThread(projectId, threadId)
  
  res.sendStatus(204)
}

async function editMessage(req, res) {
  const projectId = req.params.project_id
  const threadId = req.params.thread_id
  const messageId = req.params.message_id
  const content = req.body.content
  const userId = SessionManager.getLoggedInUserId(req.session)

  await ChatApiHandler.promises.editMessage(
    projectId,
    threadId,
    messageId,
    userId,
    content
  )
  
  res.sendStatus(204)
}

async function deleteMessage(req, res) {
  const projectId = req.params.project_id
  const threadId = req.params.thread_id
  const messageId = req.params.message_id

  await ChatApiHandler.promises.deleteMessage(projectId, threadId, messageId)
  
  res.sendStatus(204)
}

async function deleteUserMessage(req, res) {
  const projectId = req.params.project_id
  const threadId = req.params.thread_id
  const messageId = req.params.message_id
  const userId = SessionManager.getLoggedInUserId(req.session)

  await ChatApiHandler.promises.deleteUserMessage(
    projectId,
    threadId,
    userId,
    messageId
  )
  
  res.sendStatus(204)
}

export default {
  getThreads: expressify(getThreads),
  addMessage: expressify(addMessage),
  resolveThread: expressify(resolveThread),
  reopenThread: expressify(reopenThread),
  deleteThread: expressify(deleteThread),
  editMessage: expressify(editMessage),
  deleteMessage: expressify(deleteMessage),
  deleteUserMessage: expressify(deleteUserMessage),
}
