if (process.platform === 'darwin' && process.arch !== 'arm64') {
  console.error(
    `Vaultline requires arm64 Node on Apple Silicon (running ${process.version} ${process.arch}).`,
  )
  console.error('Run: nvm uninstall 24.13.0 && nvm install && nvm use')
  process.exit(1)
}
