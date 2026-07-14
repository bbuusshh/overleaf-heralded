import React, { memo, useCallback, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import Notification from '@/shared/components/notification'
import OLForm from '@/shared/components/ol/ol-form'
import OLFormGroup from '@/shared/components/ol/ol-form-group'
import OLFormControl from '@/shared/components/ol/ol-form-control'
import OLFormLabel from '@/shared/components/ol/ol-form-label'
import OLButton from '@/shared/components/ol/ol-button'
import getMeta from '@/utils/meta'
import { postJSON } from '../../infrastructure/fetch-json'

function GitSyncModal({
  show,
  handleHide,
}: {
  show: boolean
  handleHide: () => void
}) {
  const { t } = useTranslation()
  const projectId = getMeta('ol-project_id')
  const storageKeyUrl = `gitSyncUrl_${projectId}`
  const storageKeyToken = `gitSyncToken_${projectId}`
  const storageKeyBranch = `gitSyncBranch_${projectId}`

  const [gitUrl, setGitUrl] = useState('')
  const [gitToken, setGitToken] = useState('')
  const [gitBranch, setGitBranch] = useState('main')
  const [branches, setBranches] = useState<string[]>([])
  const [inFlight, setInFlight] = useState(false)
  const [fetchingBranches, setFetchingBranches] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    const savedUrl = localStorage.getItem(storageKeyUrl)
    const savedToken = localStorage.getItem(storageKeyToken)
    const savedBranch = localStorage.getItem(storageKeyBranch)
    if (savedUrl) setGitUrl(savedUrl)
    if (savedToken) setGitToken(savedToken)
    if (savedBranch) setGitBranch(savedBranch)
  }, [storageKeyUrl, storageKeyToken, storageKeyBranch])

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGitUrl(e.target.value)
    localStorage.setItem(storageKeyUrl, e.target.value)
  }

  const handleTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGitToken(e.target.value)
    localStorage.setItem(storageKeyToken, e.target.value)
  }

  const handleBranchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGitBranch(e.target.value)
    localStorage.setItem(storageKeyBranch, e.target.value)
  }

  const handleFetchBranches = async () => {
    setError(null)
    setFetchingBranches(true)
    try {
      const response = await postJSON(
        `/project/${projectId}/custom-git-branches`,
        {
          body: {
            remoteUrl: gitUrl,
            token: gitToken,
          }
        }
      )
      if (response && response.branches) {
        setBranches(response.branches)
        setSuccess(`Loaded ${response.branches.length} branches.`)
      }
    } catch (e: any) {
      setError(`Error fetching branches: ${e.message || 'Unknown error'}`)
    } finally {
      setFetchingBranches(false)
    }
  }

  const handleSyncAction = async (action: 'push' | 'pull') => {
    setError(null)
    setSuccess(null)
    setInFlight(true)

    try {
      const response = await postJSON(
        `/project/${projectId}/custom-git-${action}`,
        {
          body: {
            remoteUrl: gitUrl,
            token: gitToken,
            branch: gitBranch,
          }
        }
      )
      setSuccess(`Successfully completed ${action}! Please refresh the page if pulling to see updates.`)
    } catch (e: any) {
      setError(`Error during ${action}: ${e.message || 'Unknown error'}`)
    } finally {
      setInFlight(false)
    }
  }

  const onHide = useCallback(() => {
    if (!inFlight) {
      handleHide()
    }
  }, [handleHide, inFlight])

  return (
    <OLModal
      animation
      show={show}
      onHide={onHide}
      id="git-sync-modal"
      backdrop={inFlight ? 'static' : undefined}
    >
      <OLModalHeader onHide={onHide}>
        <OLModalTitle>Sync with Git</OLModalTitle>
      </OLModalHeader>
      <OLModalBody>
        {error && <Notification type="error" content={error} />}
        {success && <Notification type="success" content={success} />}

        <p>Sync your Overleaf project to a remote Git repository directly.</p>

        <OLForm
          onSubmit={(e: React.FormEvent) => {
            e.preventDefault()
          }}
        >
          <OLFormGroup>
            <OLFormLabel>Git Repository URL (HTTPS)</OLFormLabel>
            <OLFormControl
              type="url"
              placeholder="https://github.com/user/repo.git"
              value={gitUrl}
              onChange={handleUrlChange}
              disabled={inFlight}
            />
          </OLFormGroup>
          <OLFormGroup>
            <OLFormLabel>Personal Access Token (PAT)</OLFormLabel>
            <OLFormControl
              type="password"
              placeholder="ghp_..."
              value={gitToken}
              onChange={handleTokenChange}
              disabled={inFlight}
            />
          </OLFormGroup>
          <OLFormGroup>
            <OLFormLabel>
              Branch 
              <OLButton
                variant="link"
                size="sm"
                onClick={handleFetchBranches}
                disabled={fetchingBranches || !gitUrl || !gitToken || inFlight}
                style={{ padding: '0 5px', fontSize: '0.85em' }}
              >
                {fetchingBranches ? 'Loading...' : '(Load Branches)'}
              </OLButton>
            </OLFormLabel>
            <OLFormControl
              type="text"
              placeholder="main"
              value={gitBranch}
              onChange={handleBranchChange}
              disabled={inFlight}
              list="branchList"
            />
            <datalist id="branchList">
              {branches.map(b => <option key={b} value={b} />)}
            </datalist>
          </OLFormGroup>
        </OLForm>
      </OLModalBody>
      <OLModalFooter>
        <OLButton
          onClick={onHide}
          disabled={inFlight}
          variant="secondary"
        >
          {t('cancel')}
        </OLButton>
        <OLButton
          onClick={() => handleSyncAction('pull')}
          disabled={inFlight || !gitUrl || !gitToken}
          variant="warning"
          style={{ marginLeft: '10px' }}
        >
          {inFlight ? 'Pulling...' : 'Pull from Git'}
        </OLButton>
        <OLButton
          onClick={() => handleSyncAction('push')}
          disabled={inFlight || !gitUrl || !gitToken}
          variant="primary"
          style={{ marginLeft: '10px' }}
        >
          {inFlight ? 'Pushing...' : 'Push to Git'}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}

export default memo(GitSyncModal)
