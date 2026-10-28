cask "prosed" do
  version "0.2.3"
  sha256 "48d02c705db9e4b702d2ddb47e7cd00fa21fbbb7e00d9a52e7314875bcbbcdae"

  url "https://github.com/florianlauer/prosed/releases/download/desktop-v#{version}/prosed_#{version}_universal.dmg"
  name "prosed"
  desc "Grammar checker for text fields across macOS apps"
  homepage "https://github.com/florianlauer/prosed"

  depends_on macos: :monterey

  app "prosed.app"

  caveats <<~EOS
    Grant prosed Accessibility access in System Settings > Privacy & Security.
    Choose a cloud provider in settings, or install Ollama for local checks.
  EOS
end
