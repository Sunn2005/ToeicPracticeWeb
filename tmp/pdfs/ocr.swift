import AppKit
import Foundation
import Vision

guard CommandLine.arguments.count >= 2 else {
    fputs("Usage: ocr.swift [--output path] <image> [image ...]\n", stderr)
    exit(1)
}

var arguments = Array(CommandLine.arguments.dropFirst())
var outputPath: String?
if arguments.count >= 2 && arguments[0] == "--output" {
    outputPath = arguments[1]
    arguments.removeFirst(2)
}

var outputLines: [String] = []

for imagePath in arguments {
    guard let image = NSImage(contentsOfFile: imagePath),
          let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
        fputs("Could not open \(imagePath)\n", stderr)
        continue
    }

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["en-US"]
    request.usesLanguageCorrection = true

    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    try handler.perform([request])

    let observations = (request.results ?? []).sorted { lhs, rhs in
        let verticalDifference = abs(lhs.boundingBox.maxY - rhs.boundingBox.maxY)
        if verticalDifference > 0.008 {
            return lhs.boundingBox.maxY > rhs.boundingBox.maxY
        }
        return lhs.boundingBox.minX < rhs.boundingBox.minX
    }

    outputLines.append("===== \((imagePath as NSString).lastPathComponent) =====")
    for observation in observations {
        guard let candidate = observation.topCandidates(1).first else { continue }
        let box = observation.boundingBox
        outputLines.append(
            String(
                format: "[x=%.4f y=%.4f w=%.4f h=%.4f] %@",
                box.minX,
                box.minY,
                box.width,
                box.height,
                candidate.string
            )
        )
    }
}

let output = outputLines.joined(separator: "\n") + "\n"
if let outputPath {
    try output.write(toFile: outputPath, atomically: true, encoding: .utf8)
} else {
    print(output, terminator: "")
}
