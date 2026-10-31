import AppKit
import AVFoundation

guard CommandLine.arguments.count >= 3 else {
  fputs("usage: extract-frames.swift <video> <output-dir> [seconds...]\n", stderr)
  exit(2)
}

let videoURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
try FileManager.default.createDirectory(at: outputURL, withIntermediateDirectories: true)

let seconds = CommandLine.arguments.dropFirst(3).compactMap(Double.init)
let times = seconds.isEmpty ? [1.0, 4.0, 7.0, 12.0, 16.0, 20.0] : seconds
let asset = AVAsset(url: videoURL)
let generator = AVAssetImageGenerator(asset: asset)
generator.appliesPreferredTrackTransform = true
generator.requestedTimeToleranceBefore = .zero
generator.requestedTimeToleranceAfter = .zero

for second in times {
  let image = try generator.copyCGImage(
    at: CMTime(seconds: second, preferredTimescale: 600),
    actualTime: nil
  )
  let bitmap = NSBitmapImageRep(cgImage: image)
  guard let data = bitmap.representation(using: .png, properties: [:]) else {
    throw NSError(domain: "VaultlineFrames", code: 1)
  }
  let target = outputURL.appendingPathComponent(
    String(format: "frame-%05.1f.png", second)
  )
  try data.write(to: target)
}
