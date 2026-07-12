import React, { useMemo } from 'react'
import getMeta from '../../utils/meta'
import { useProjectContext } from '../../shared/context/project-context'
import GitForkIcon from '../../shared/svgs/git-fork'

export default function GitBridgePanel() {
  const { projectId } = useProjectContext()
  const gitBridgeEnabled = getMeta('ol-gitBridgeEnabled')
  const gitBridgePublicBaseUrl = getMeta('ol-gitBridgePublicBaseUrl')

  const gitUrl = useMemo(() => {
    if (!gitBridgePublicBaseUrl || !projectId) return ''
    const baseUrl = gitBridgePublicBaseUrl.replace(/\/$/, '')
    return `${baseUrl}/${projectId}`
  }, [gitBridgePublicBaseUrl, projectId])

  if (!gitBridgeEnabled) {
    return null
  }

  return (
    <div style={{ padding: '16px', borderBottom: '1px solid var(--ol-color-border, #ccc)' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ marginRight: '8px' }}>
           <GitForkIcon />
        </div>
        <div style={{ fontWeight: 'bold', fontSize: '1.1em' }} translate="no">Git Bridge</div>
      </div>
      <p style={{ marginBottom: '16px' }}>
        Clone this project to your local machine using Git. 
        You will need to generate a Git Authentication Token in your User Settings.
      </p>

      {gitUrl && (
        <div className="form-group">
          <label style={{ fontWeight: 'bold' }}>Git Clone URL</label>
          <input 
            type="text" 
            className="form-control" 
            value={`git clone ${gitUrl}`} 
            readOnly 
            onClick={(e) => (e.target as HTMLInputElement).select()}
            style={{ fontFamily: 'monospace', width: '100%', padding: '6px', marginTop: '4px' }}
          />
        </div>
      )}
    </div>
  )
}
