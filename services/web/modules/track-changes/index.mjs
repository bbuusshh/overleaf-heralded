console.log('======= TRACK CHANGES MODULE EVALUATED =======')
import TrackChangesController from './TrackChangesController.mjs'
import AuthorizationMiddleware from '../../app/src/Features/Authorization/AuthorizationMiddleware.mjs'
import AsyncLocalStorage from '../../app/src/infrastructure/AsyncLocalStorage.mjs'
import ProjectEditorHandler from '../../app/src/Features/Project/ProjectEditorHandler.mjs'
import Settings from '@overleaf/settings'

function apply(webRouter, privateApiRouter) {
  console.log('======= TRACK CHANGES MODULE LOADED =======')
  ProjectEditorHandler.trackChangesAvailable = true
  Settings.enableGitBridge = true
  
  const originalBuild = ProjectEditorHandler.buildProjectModelView
  ProjectEditorHandler.buildProjectModelView = function(...args) {
    const result = originalBuild.apply(this, args)
    if (result && result.features) {
      result.features.trackChanges = true
      result.features.trackChangesVisible = true
      result.features.gitBridge = true
      result.features.github = true
    }
    return result
  }

  webRouter.get(
    '/project/:project_id/threads',
    AsyncLocalStorage.middleware,
    AuthorizationMiddleware.ensureUserCanReadProject,
    TrackChangesController.getThreads
  )
  
  webRouter.post(
    '/project/:project_id/thread/:thread_id/messages',
    AsyncLocalStorage.middleware,
    AuthorizationMiddleware.ensureUserCanWriteOrReviewProjectContent,
    TrackChangesController.addMessage
  )
  
  webRouter.post(
    '/project/:project_id/doc/:doc_id/thread/:thread_id/resolve',
    AsyncLocalStorage.middleware,
    AuthorizationMiddleware.ensureUserCanWriteOrReviewProjectContent,
    TrackChangesController.resolveThread
  )
  
  webRouter.post(
    '/project/:project_id/doc/:doc_id/thread/:thread_id/reopen',
    AsyncLocalStorage.middleware,
    AuthorizationMiddleware.ensureUserCanWriteOrReviewProjectContent,
    TrackChangesController.reopenThread
  )
  
  webRouter.delete(
    '/project/:project_id/doc/:doc_id/thread/:thread_id',
    AsyncLocalStorage.middleware,
    AuthorizationMiddleware.ensureUserCanWriteOrReviewProjectContent,
    TrackChangesController.deleteThread
  )
  
  webRouter.post(
    '/project/:project_id/thread/:thread_id/messages/:message_id/edit',
    AsyncLocalStorage.middleware,
    AuthorizationMiddleware.ensureUserCanWriteOrReviewProjectContent,
    TrackChangesController.editMessage
  )
  
  webRouter.delete(
    '/project/:project_id/thread/:thread_id/messages/:message_id',
    AsyncLocalStorage.middleware,
    AuthorizationMiddleware.ensureUserCanWriteOrReviewProjectContent,
    TrackChangesController.deleteMessage
  )
  
  webRouter.delete(
    '/project/:project_id/thread/:thread_id/own-messages/:message_id',
    AsyncLocalStorage.middleware,
    AuthorizationMiddleware.ensureUserCanWriteOrReviewProjectContent,
    TrackChangesController.deleteUserMessage
  )
}
export default { apply }
