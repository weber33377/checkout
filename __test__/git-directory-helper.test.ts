import * as core from '@actions/core'
import * as fs from 'fs'
import * as gitDirectoryHelper from '../lib/git-directory-helper'
import * as io from '@actions/io'
import * as path from 'path'
import {IGitCommandManager} from '../lib/git-command-manager'

const testWorkspace = path.join(__dirname, '_temp', 'git-directory-helper')
let repositoryPath: string
let httpsUrl: string
let sshUrl: string
let clean: boolean
let git: IGitCommandManager

describe('git-directory-helper tests', () => {
  beforeAll(async () => {
    // Clear test workspace
    await io.rmRF(testWorkspace)
  })

  beforeEach(() => {
    // Mock error/warning/info/debug
    jest.spyOn(core, 'error').mockImplementation(jest.fn())
    jest.spyOn(core, 'warning').mockImplementation(jest.fn())
    jest.spyOn(core, 'info').mockImplementation(jest.fn())
    jest.spyOn(core, 'debug').mockImplementation(jest.fn())
  })

  afterEach(() => {
    // Unregister mocks
    jest.restoreAllMocks()
  })

  const cleansWhenCleanTrue = 'cleans when clean true'
  it(cleansWhenCleanTrue, async () => {
    // Arrange
    await setup(cleansWhenCleanTrue)
    await fs.promises.writeFile(path.join(repositoryPath, 'my-file'), '')

    // Act
    await gitDirectoryHelper.prepareExistingDirectory(
      git,
      repositoryPath,
      httpsUrl,
      [httpsUrl, sshUrl],
      clean
    )

    // Assert
    const files = await fs.promises.readdir(repositoryPath)
    expect(files.sort()).toEqual(['.git', 'my-file'])
    expect(git.tryClean).toHaveBeenCalled()
    expect(git.tryReset).toHaveBeenCalled()
    expect(core.warning).not.toHaveBeenCalled()
  })

  const checkoutDetachWhenNotDetached = 'checkout detach when not detached'
  it(checkoutDetachWhenNotDetached, async () => {
    // Arrange
    await setup(checkoutDetachWhenNotDetached)
    await fs.promises.writeFile(path.join(repositoryPath, 'my-file'), '')

    // Act
    await gitDirectoryHelper.prepareExistingDirectory(
      git,
      repositoryPath,
      httpsUrl,
      [httpsUrl, sshUrl],
      clean
    )

    // Assert
    const files = await fs.promises.readdir(repositoryPath)
    expect(files.sort()).toEqual(['.git', 'my-file'])
    expect(git.checkoutDetach).toHaveBeenCalled()
  })

  const doesNotCheckoutDetachWhenNotAlreadyDetached =
    'does not checkout detach when already detached'
  it(doesNotCheckoutDetachWhenNotAlreadyDetached, async () => {
    // Arrange
    await setup(doesNotCheckoutDetachWhenNotAlreadyDetached)
    await fs.promises.writeFile(path.join(repositoryPath, 'my-file'), '')
    const mockIsDetached = git.isDetached as jest.Mock<any, any>
    mockIsDetached.mockImplementation(async () => {
      return true
    })

    // Act
    await gitDirectoryHelper.prepareExistingDirectory(
      git,
      repositoryPath,
      httpsUrl,
      [httpsUrl, sshUrl],
      clean
    )

    // Assert
    const files = await fs.promises.readdir(repositoryPath)
    expect(files.sort()).toEqual(['.git', 'my-file'])
    expect(git.checkoutDetach).not.toHaveBeenCalled()
  })

  const doesNotCleanWhenCleanFalse = 'does not clean when clean false'
  it(doesNotCleanWhenCleanFalse, async () => {
    // Arrange
    await setup(doesNotCleanWhenCleanFalse)
    clean = false
    await fs.promises.writeFile(path.join(repositoryPath, 'my-file'), '')

    // Act
    await gitDirectoryHelper.prepareExistingDirectory(
      git,
      repositoryPath,
      httpsUrl,
      [httpsUrl, sshUrl],
      clean
    )

    // Assert
    const files = await fs.promises.readdir(repositoryPath)
    expect(files.sort()).toEqual(['.git', 'my-file'])
    expect(git.isDetached).toHaveBeenCalled()
    expect(git.branchList).toHaveBeenCalled()
    expect(core.warning).not.toHaveBeenCalled()
    expect(git.tryClean).not.toHaveBeenCalled()
    expect(git.tryReset).not.toHaveBeenCalled()
  })

  const removesContentsWhenCleanFails = 'removes contents when clean fails'
  it(removesContentsWhenCleanFails, async () => {
    // Arrange
    await setup(removesContentsWhenCleanFails)
    await fs.promises.writeFile(path.join(repositoryPath, 'my-file'), '')
    let mockTryClean = git.tryClean as jest.Mock<any, any>
    mockTryClean.mockImplementation(async () => {
      return false
    })

    // Act
    await gitDirectoryHelper.prepareExistingDirectory(
      git,
      repositoryPath,
      httpsUrl,
      [httpsUrl, sshUrl],
      clean
    )

    // Assert
    const files = await fs.promises.readdir(repositoryPath)
    expect(files).toHaveLength(0)
    expect(git.tryClean).toHaveBeenCalled()
    expect(core.warning).toHaveBeenCalled()
    expect(git.tryReset).not.toHaveBeenCalled()
  })

  const removesContentsWhenDifferentRepositoryUrl =
    'removes contents when different repository url'
  it(removesContentsWhenDifferentRepositoryUrl, async () => {
    // Arrange
    await setup(removesContentsWhenDifferentRepositoryUrl)
    clean = false
    await fs.promises.writeFile(path.join(repositoryPath, 'my-file'), '')
    const differentRemoteUrl =
      'https://github.com/my-different-org/my-different-repo'

    // Act
    await gitDirectoryHelper.prepareExistingDirectory(
      git,
      repositoryPath,
      differentRemoteUrl,
      [differentRemoteUrl],
      clean
    )

    // Assert
    const files = await fs.promises.readdir(repositoryPath)
    expect(files).toHaveLength(0)
    expect(core.warning).not.toHaveBeenCalled()
    expect(git.isDetached).not.toHaveBeenCalled()
  })

  const removesContentsWhenNoGitDirectory =
    'removes contents when no git directory'
  it(removesContentsWhenNoGitDirectory, async () => {
    // Arrange
    await setup(removesContentsWhenNoGitDirectory)
    clean = false
    await io.rmRF(path.join(repositoryPath, '.git'))
    await fs.promises.writeFile(path.join(repositoryPath, 'my-file'), '')

    // Act
    await gitDirectoryHelper.prepareExistingDirectory(
      git,
      repositoryPath,
      httpsUrl,
      [httpsUrl, sshUrl],
      clean
    )

    // Assert
    const files = await fs.promises.readdir(repositoryPath)
    expect(files).toHaveLength(0)
    expect(core.warning).not.toHaveBeenCalled()
    expect(git.isDetached).not.toHaveBeenCalled()
  })

  const removesContentsWhenResetFails = 'removes contents when reset fails'
  it(removesContentsWhenResetFails, async () => {
    // Arrange
    await setup(removesContentsWhenResetFails)
    await fs.promises.writeFile(path.join(repositoryPath, 'my-file'), '')
    let mockTryReset = git.tryReset as jest.Mock<any, any>
    mockTryReset.mockImplementation(async () => {
      return false
    })

    // Act
    await gitDirectoryHelper.prepareExistingDirectory(
      git,
      repositoryPath,
      httpsUrl,
      [httpsUrl, sshUrl],
      clean
    )

    // Assert
    const files = await fs.promises.readdir(repositoryPath)
    expect(files).toHaveLength(0)
    expect(git.tryClean).toHaveBeenCalled()
    expect(git.tryReset).toHaveBeenCalled()
    expect(core.warning).toHaveBeenCalled()
  })

  const removesContentsWhenUndefinedGitCommandManager =
    'removes contents when undefined git command manager'
  it(removesContentsWhenUndefinedGitCommandManager, async () => {
    // Arrange
    await setup(removesContentsWhenUndefinedGitCommandManager)
    clean = false
    await fs.promises.writeFile(path.join(repositoryPath, 'my-file'), '')

    // Act
    await gitDirectoryHelper.prepareExistingDirectory(
      undefined,
      repositoryPath,
      httpsUrl,
      [httpsUrl, sshUrl],
      clean
    )

    // Assert
    const files = await fs.promises.readdir(repositoryPath)
    expect(files).toHaveLength(0)
    expect(core.warning).not.toHaveBeenCalled()
  })

  const removesLocalBranches = 'removes local branches'
  it(removesLocalBranches, async () => {
    // Arrange
    await setup(removesLocalBranches)
    await fs.promises.writeFile(path.join(repositoryPath, 'my-file'), '')
    const mockBranchList = git.branchList as jest.Mock<any, any>
    mockBranchList.mockImplementation(async (remote: boolean) => {
      return remote ? [] : ['local-branch-1', 'local-branch-2']
    })

    // Act
    await gitDirectoryHelper.prepareExistingDirectory(
      git,
      repositoryPath,
      httpsUrl,
      [httpsUrl, sshUrl],
      clean
    )

    // Assert
    const files = await fs.promises.readdir(repositoryPath)
    expect(files.sort()).toEqual(['.git', 'my-file'])
    expect(git.branchDelete).toHaveBeenCalledWith(false, 'local-branch-1')
    expect(git.branchDelete).toHaveBeenCalledWith(false, 'local-branch-2')
  })

  const removesLockFiles = 'removes lock files'
  it(removesLockFiles, async () => {
    // Arrange
    await setup(removesLockFiles)
    clean = false
    await fs.promises.writeFile(
      path.join(repositoryPath, '.git', 'index.lock'),
      ''
    )
    await fs.promises.writeFile(
      path.join(repositoryPath, '.git', 'shallow.lock'),
      ''
    )
    await fs.promises.writeFile(path.join(repositoryPath, 'my-file'), '')

    // Act
    await gitDirectoryHelper.prepareExistingDirectory(
      git,
      repositoryPath,
      httpsUrl,
      [httpsUrl, sshUrl],
      clean
    )

    // Assert
    let files = await fs.promises.readdir(path.join(repositoryPath, '.git'))
    expect(files).toHaveLength(0)
    files = await fs.promises.readdir(repositoryPath)
    expect(files.sort()).toEqual(['.git', 'my-file'])
    expect(git.isDetached).toHaveBeenCalled()
    expect(git.branchList).toHaveBeenCalled()
    expect(core.warning).not.toHaveBeenCalled()
    expect(git.tryClean).not.toHaveBeenCalled()
    expect(git.tryReset).not.toHaveBeenCalled()
  })

  const removesRemoteBranches = 'removes local branches'
  it(removesRemoteBranches, async () => {
    // Arrange
    await setup(removesRemoteBranches)
    await fs.promises.writeFile(path.join(repositoryPath, 'my-file'), '')
    const mockBranchList = git.branchList as jest.Mock<any, any>
    mockBranchList.mockImplementation(async (remote: boolean) => {
      return remote ? ['remote-branch-1', 'remote-branch-2'] : []
    })

    // Act
    await gitDirectoryHelper.prepareExistingDirectory(
      git,
      repositoryPath,
      httpsUrl,
      [httpsUrl, sshUrl],
      clean
    )

    // Assert
    const files = await fs.promises.readdir(repositoryPath)
    expect(files.sort()).toEqual(['.git', 'my-file'])
    expect(git.branchDelete).toHaveBeenCalledWith(true, 'remote-branch-1')
    expect(git.branchDelete).toHaveBeenCalledWith(true, 'remote-branch-2')
  })

  const updatesRemoteUrl = 'updates remote URL'
  it(updatesRemoteUrl, async () => {
    // Arrange
    await setup(updatesRemoteUrl)
    await fs.promises.writeFile(path.join(repositoryPath, 'my-file'), '')

    // Act
    await gitDirectoryHelper.prepareExistingDirectory(
      git,
      repositoryPath,
      sshUrl,
      [sshUrl, httpsUrl],
      clean
    )

    // Assert
    const files = await fs.promises.readdir(repositoryPath)
    expect(files.sort()).toEqual(['.git', 'my-file'])
    expect(git.isDetached).toHaveBeenCalled()
    expect(git.branchList).toHaveBeenCalled()
    expect(core.warning).not.toHaveBeenCalled()
    expect(git.setRemoteUrl).toHaveBeenCalledWith(sshUrl)
  })
})

async function setup(testName: string): Promise<void> {
  testName = testName.replace(/[^a-zA-Z0-9_]+/g, '-')

  // Repository directory
  repositoryPath = path.join(testWorkspace, testName)
  await fs.promises.mkdir(path.join(repositoryPath, '.git'), {recursive: true})

  // Remote URLs
  httpsUrl = 'https://github.com/my-org/my-repo'
  sshUrl = 'git@github.com:my-org/my-repo'

  // Clean
  clean = true

  // Git command manager
  git = {
    branchDelete: jest.fn(),
    branchExists: jest.fn(),
    branchList: jest.fn(async () => {
      return []
    }),
    checkout: jest.fn(),
    checkoutDetach: jest.fn(),
    config: jest.fn(),
    configExists: jest.fn(),
    fetch: jest.fn(),
    getWorkingDirectory: jest.fn(() => repositoryPath),
    init: jest.fn(),
    isDetached: jest.fn(),
    lfsFetch: jest.fn(),
    lfsInstall: jest.fn(),
    log1: jest.fn(),
    remoteAdd: jest.fn(),
    removeEnvironmentVariable: jest.fn(),
    setEnvironmentVariable: jest.fn(),
    setRemoteUrl: jest.fn(),
    submoduleForeach: jest.fn(),
    submoduleSync: jest.fn(),
    submoduleUpdate: jest.fn(),
    tagExists: jest.fn(),
    tryClean: jest.fn(async () => {
      return true
    }),
    tryConfigUnset: jest.fn(),
    tryDisableAutomaticGarbageCollection: jest.fn(),
    tryGetRemoteUrl: jest.fn(async () => {
      // Sanity check - this function shouldn't be called when the .git directory doesn't exist
      await fs.promises.stat(path.join(repositoryPath, '.git'))
      return httpsUrl
    }),
    tryReset: jest.fn(async () => {
      return true
    })
  }
}
