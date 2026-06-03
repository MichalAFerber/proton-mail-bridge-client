# Homebrew formula for proton-mail-bridge-client
#
# To use this:
# 1. Publish the npm package first: npm publish
# 2. Create a new GitHub repo: googlarz/homebrew-tap
# 3. Copy this file to: Formula/proton-mail-bridge-client.rb in that repo
# 4. Update the sha256 below (run: curl -s https://registry.npmjs.org/proton-mail-bridge-client/1.11.0 | jq .dist.shasum)
#
# Users install with: brew install googlarz/tap/proton-mail-bridge-client

require "language/node"

class ProtonMailBridgeClient < Formula
  desc "Full-featured CLI and Claude Desktop MCP for Proton Mail via Proton Bridge"
  homepage "https://github.com/googlarz/proton-mail-bridge-client"
  url "https://registry.npmjs.org/proton-mail-bridge-client/-/proton-mail-bridge-client-1.11.0.tgz"
  # Update sha256 after npm publish:
  #   curl -sL https://registry.npmjs.org/proton-mail-bridge-client/-/proton-mail-bridge-client-1.11.0.tgz | shasum -a 256
  sha256 "9109c7532cc05d3f1d689f2ce538e4d5ed2bdbe3"
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
    # Verify the binary runs (exits non-zero without credentials — that's expected)
    output = shell_output("#{bin}/proton-mail-bridge-client --help 2>&1", 0)
    assert_match "proton-mail-bridge-client", output
  end
end
