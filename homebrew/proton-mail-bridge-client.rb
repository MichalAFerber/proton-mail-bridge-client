# Homebrew formula for proton-mail-bridge-client
# Users install with: brew install googlarz/tap/proton-mail-bridge-client

require "language/node"

class ProtonMailBridgeClient < Formula
  desc "Full-featured CLI and Claude Desktop MCP for Proton Mail via Proton Bridge"
  homepage "https://github.com/googlarz/proton-mail-bridge-client"
  url "https://registry.npmjs.org/proton-mail-bridge-client/-/proton-mail-bridge-client-1.11.1.tgz"
  sha256 "566281095a4789f838ea620909de3461827579ab"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *Language::Node.std_npm_install_args(libexec)
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  def caveats
    <<~EOS
      Proton Mail Bridge must be running before using this tool.
      Download Bridge at: https://proton.me/mail/bridge

      Required environment variables (add to ~/.zshrc or ~/.bash_profile):
        export PROTONMAIL_USERNAME='you@proton.me'
        export PROTONMAIL_PASSWORD='your-bridge-password'

      Then run: proton-mail-bridge-client status
    EOS
  end

  test do
    output = shell_output("#{bin}/proton-mail-bridge-client --version 2>&1")
    assert_match "1.11.1", output
  end
end
