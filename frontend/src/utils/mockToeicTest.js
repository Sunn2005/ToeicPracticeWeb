/**
 * Generates a full standard 200-question TOEIC test with valid structure
 * across all 7 Parts (6 + 25 + 39 + 30 + 30 + 16 + 54 = 200 questions).
 * Perfect for developer testing, automated previews, and submission validation.
 */
export function generateMockToeicTest(customTitle = "ETS TOEIC 2024 Test 01 — Full Assessment") {
  // Part 1: Photographs (6 questions: 1 to 6)
  const part1Questions = Array.from({ length: 6 }, (_, i) => {
    const qNum = i + 1;
    return {
      questionNumber: qNum,
      question: "Select the statement that best describes the picture.",
      answers: [
        { label: "A", content: "The person is working at the desk." },
        { label: "B", content: "They are looking at the presentation screen." },
        { label: "C", content: "Equipment is being set up in the conference room." },
        { label: "D", content: "Documents are being organized in folders." },
      ],
      correctAnswer: ["B", "A", "C", "A", "D", "B"][i],
      imageUrl: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&auto=format&fit=crop&q=80",
      audioUrl: "https://actions.google.com/sounds/v1/ambiences/office_working.ogg",
      transcript: "A man and a woman are reviewing documents together in an office.",
      transcriptTranslation: "Một người đàn ông và phụ nữ đang xem xét tài liệu cùng nhau trong văn phòng.",
      explanation: "Lựa chọn miêu tả chính xác nhất hành động trọng tâm trong bức ảnh.",
      explanationTranslation: "Lựa chọn B miêu tả đúng nhất hoạt động của các nhân vật trong ảnh.",
    };
  });

  // Part 2: Question-Response (25 questions: 7 to 31, 3 options: A, B, C)
  const part2Questions = Array.from({ length: 25 }, (_, i) => {
    const qNum = i + 7;
    const correctOptions = ["A", "B", "C", "A", "B", "C", "B", "A", "C", "B"];
    return {
      questionNumber: qNum,
      question: `Question ${qNum}: Where will the quarterly team meeting take place?`,
      answers: [
        { label: "A", content: "In conference room B on the third floor." },
        { label: "B", content: "At about three o'clock tomorrow afternoon." },
        { label: "C", content: "Yes, I already received the agenda." },
      ],
      correctAnswer: correctOptions[i % correctOptions.length],
      audioUrl: "https://actions.google.com/sounds/v1/ambiences/office_working.ogg",
      transcript: "Where will the quarterly team meeting take place?",
      transcriptTranslation: "Cuộc họp quý của nhóm sẽ diễn ra ở đâu?",
      explanation: "Câu hỏi bắt đầu bằng 'Where' yêu cầu câu trả lời chỉ địa điểm.",
      explanationTranslation: "Đáp án A trả lời chính xác cho câu hỏi hỏi nơi chốn (Where).",
    };
  });

  // Part 3: Conversations (13 groups x 3 questions = 39 questions: 32 to 70)
  const part3Groups = Array.from({ length: 13 }, (_, gIdx) => {
    const startQ = 32 + gIdx * 3;
    const endQ = startQ + 2;
    return {
      questionRange: `${startQ}-${endQ}`,
      audioUrl: "https://actions.google.com/sounds/v1/ambiences/office_working.ogg",
      imageUrl: gIdx === 3 ? "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=600&auto=format&fit=crop&q=80" : "",
      transcript: "Woman: Hi Marcus, do you have the updated financial report for the client meeting?\nMan: Yes, I finished reviewing it this morning. Let me print a copy for you.\nWoman: Thanks, I also noticed the venue was moved to the auditorium.",
      transcriptTranslation: "Nữ: Chào Marcus, bạn có bản báo cáo tài chính cập nhật chưa?\nNam: Tôi vừa xem xong sáng nay, để tôi in cho bạn một bản.\nNữ: Cảm ơn, tôi cũng thấy địa điểm đã đổi sang hội trường.",
      questions: [
        {
          questionNumber: startQ,
          question: "What are the speakers mainly discussing?",
          answers: [
            { label: "A", content: "A financial report for a meeting" },
            { label: "B", content: "Travel arrangements for a trip" },
            { label: "C", content: "A new software installation" },
            { label: "D", content: "Hiring a new staff member" },
          ],
          correctAnswer: "A",
          explanation: "Người phụ nữ mở đầu hỏi về bản báo cáo tài chính cho cuộc họp khách hàng.",
        },
        {
          questionNumber: startQ + 1,
          question: "What will the man do next?",
          answers: [
            { label: "A", content: "Call the client" },
            { label: "B", content: "Print a document" },
            { label: "C", content: "Book a conference room" },
            { label: "D", content: "Send an email" },
          ],
          correctAnswer: "B",
          explanation: "Người đàn ông nói: 'Let me print a copy for you'.",
        },
        {
          questionNumber: endQ,
          question: "What does the woman say about the meeting venue?",
          answers: [
            { label: "A", content: "It is under renovation" },
            { label: "B", content: "It has been moved to the auditorium" },
            { label: "C", content: "It needs more seating" },
            { label: "D", content: "It is closed today" },
          ],
          correctAnswer: "B",
          explanation: "Người phụ nữ nói: 'the venue was moved to the auditorium'.",
        },
      ],
    };
  });

  // Part 4: Short Talks (10 groups x 3 questions = 30 questions: 71 to 100)
  const part4Groups = Array.from({ length: 10 }, (_, gIdx) => {
    const startQ = 71 + gIdx * 3;
    const endQ = startQ + 2;
    return {
      questionRange: `${startQ}-${endQ}`,
      audioUrl: "https://actions.google.com/sounds/v1/ambiences/office_working.ogg",
      transcript: "Good morning everyone. This announcement is for all passengers travelling on Flight 412 to Chicago. Due to weather conditions, boarding will be delayed by twenty minutes. Please remain near Gate 14.",
      transcriptTranslation: "Chào buổi sáng. Thông báo này dành cho hành khách chuyến bay 412 đi Chicago. Do thời tiết, giờ lên máy bay sẽ hoãn 20 phút. Vui lòng đợi gần Cổng 14.",
      questions: [
        {
          questionNumber: startQ,
          question: "Where is the announcement most likely taking place?",
          answers: [
            { label: "A", content: "At a train station" },
            { label: "B", content: "At an airport terminal" },
            { label: "C", content: "On a tour bus" },
            { label: "D", content: "At a hotel lobby" },
          ],
          correctAnswer: "B",
          explanation: "Thông báo về 'flight', 'passengers', 'Gate 14' chỉ có ở sân bay.",
        },
        {
          questionNumber: startQ + 1,
          question: "What is the reason for the delay?",
          answers: [
            { label: "A", content: "Mechanical problems" },
            { label: "B", content: "Weather conditions" },
            { label: "C", content: "Staff shortage" },
            { label: "D", content: "Air traffic control" },
          ],
          correctAnswer: "B",
          explanation: "Người nói nêu rõ: 'Due to weather conditions'.",
        },
        {
          questionNumber: endQ,
          question: "What are listeners instructed to do?",
          answers: [
            { label: "A", content: "Board immediately" },
            { label: "B", content: "Remain near Gate 14" },
            { label: "C", content: "Pick up meal vouchers" },
            { label: "D", content: "Rebook their tickets" },
          ],
          correctAnswer: "B",
          explanation: "Người nói yêu cầu: 'Please remain near Gate 14'.",
        },
      ],
    };
  });

  // Part 5: Incomplete Sentences (30 questions: 101 to 130)
  const part5Questions = Array.from({ length: 30 }, (_, i) => {
    const qNum = 101 + i;
    const correctOptions = ["A", "B", "C", "D", "B", "C", "A", "D", "C", "B"];
    return {
      questionNumber: qNum,
      question: `Ms. Henderson _______ reviewed the financial audit before submitting it to the executive board.`,
      answers: [
        { label: "A", content: "carefully" },
        { label: "B", content: "careful" },
        { label: "C", content: "care" },
        { label: "D", content: "caring" },
      ],
      correctAnswer: correctOptions[i % correctOptions.length],
      explanation: "Cần một trạng từ (adverb) bổ nghĩa cho động từ 'reviewed'. Chọn 'carefully'.",
      explanationTranslation: "Vị trí giữa chủ ngữ và động từ chính cần trạng từ 'carefully' để bổ nghĩa.",
    };
  });

  // Part 6: Text Completion (4 passages x 4 questions = 16 questions: 131 to 146)
  const part6Passages = Array.from({ length: 4 }, (_, pIdx) => {
    const startQ = 131 + pIdx * 4;
    return {
      passageNumber: pIdx + 1,
      text: `To: All Department Heads\nFrom: Facilities Management\nSubject: Office Renovations\n\nPlease be advised that the main cafeteria on the 2nd floor will be [${startQ}] for renovations starting next Monday. Construction crews will work diligently to [${startQ + 1}] modern kitchen facilities. During this period, food trucks will be parked in the north lot. We apologize for any [${startQ + 2}] this may cause. If you have special dietary questions, [${startQ + 3}] the catering manager.`,
      passages: [
        {
          title: `Thông báo sửa chữa cơ sở vật chất (Đoạn ${pIdx + 1})`,
          text: `To: All Department Heads\nFrom: Facilities Management\nSubject: Office Renovations\n\nPlease be advised that the main cafeteria on the 2nd floor will be [${startQ}] for renovations starting next Monday. Construction crews will work diligently to [${startQ + 1}] modern kitchen facilities. During this period, food trucks will be parked in the north lot. We apologize for any [${startQ + 2}] this may cause. If you have special dietary questions, [${startQ + 3}] the catering manager.`,
          translation: "Thông báo về việc sửa chữa khu vực nhà ăn tầng 2 từ thứ Hai tới...",
        },
      ],
      questions: [
        {
          questionNumber: startQ,
          question: `Question ${startQ}`,
          answers: [
            { label: "A", content: "closed" },
            { label: "B", content: "close" },
            { label: "C", content: "closing" },
            { label: "D", content: "closure" },
          ],
          correctAnswer: "A",
          explanation: "Cấu trúc bị động 'will be closed'.",
        },
        {
          questionNumber: startQ + 1,
          question: `Question ${startQ + 1}`,
          answers: [
            { label: "A", content: "install" },
            { label: "B", content: "installed" },
            { label: "C", content: "installation" },
            { label: "D", content: "installer" },
          ],
          correctAnswer: "A",
          explanation: "Sau 'to' dùng động từ nguyên thể 'to install'.",
        },
        {
          questionNumber: startQ + 2,
          question: `Question ${startQ + 2}`,
          answers: [
            { label: "A", content: "inconvenience" },
            { label: "B", content: "celebration" },
            { label: "C", content: "compliment" },
            { label: "D", content: "excitement" },
          ],
          correctAnswer: "A",
          explanation: "Cụm 'apologize for any inconvenience' (xin lỗi vì sự bất tiện).",
        },
        {
          questionNumber: startQ + 3,
          question: `Question ${startQ + 3}`,
          answers: [
            { label: "A", content: "contact" },
            { label: "B", content: "contacted" },
            { label: "C", content: "contacting" },
            { label: "D", content: "contacts" },
          ],
          correctAnswer: "A",
          explanation: "Câu mệnh lệnh bắt đầu bằng động từ nguyên thể 'contact'.",
        },
      ],
    };
  });

  // Part 7: Reading Comprehension (54 questions: 147 to 200)
  // Let's create 15 passage groups covering all 54 questions
  const part7Specs = [
    { count: 2, title: "Email trao đổi công việc" },
    { count: 2, title: "Thông báo tuyển dụng" },
    { count: 3, title: "Lịch trình hội thảo & Đăng ký" },
    { count: 3, title: "Hóa đơn và Đơn đặt hàng" },
    { count: 4, title: "Bài báo về thị trường công nghệ" },
    { count: 4, title: "Thư chào hàng và Báo giá" },
    { count: 4, title: "Quy định an toàn lao động" },
    { count: 4, title: "Đánh giá của khách hàng về dịch vụ" },
    { count: 4, title: "Chính sách bảo hành sản phẩm" },
    { count: 4, title: "Báo cáo doanh số quý 3" },
    { count: 5, title: "Email đôi: Yêu cầu & Phản hồi" },
    { count: 5, title: "Email đôi: Hợp đồng và Phụ lục" },
    { count: 5, title: "Bộ ba tài liệu: Lịch trình, Email & Đánh giá" },
    { count: 5, title: "Bộ ba tài liệu: Đặt hàng, Hóa đơn & Khiếu nại" },
  ];

  let currentPart7Q = 147;
  const part7Groups = part7Specs.map((spec, gIdx) => {
    const qCount = spec.count;
    const startQ = currentPart7Q;
    currentPart7Q += qCount;

    return {
      groupNumber: gIdx + 1,
      imageUrls: [],
      passages: [
        {
          title: spec.title,
          text: `DOCUMENT ${gIdx + 1}: ${spec.title}\n\nDear Team,\nWe are pleased to announce that our annual performance review has concluded with remarkable achievements across all regional branches. Thanks to your tireless efforts, client satisfaction ratings have increased by 18% compared to the previous fiscal year.\n\nPlease review your individualized feedback summaries available in the employee portal by Friday.\n\nSincerely,\nExecutive Committee`,
          translation: "Bản dịch tài liệu tham khảo cho bài đọc...",
        },
      ],
      questions: Array.from({ length: qCount }, (_, i) => {
        const qNum = startQ + i;
        return {
          questionNumber: qNum,
          question: `What is indicated about the announcement in question ${qNum}?`,
          answers: [
            { label: "A", content: "Client satisfaction increased by 18%." },
            { label: "B", content: "The branch will be closed this Friday." },
            { label: "C", content: "A new branch is opening abroad." },
            { label: "D", content: "Salaries are being renegotiated." },
          ],
          correctAnswer: "A",
          explanation: "Văn bản nêu rõ: 'client satisfaction ratings have increased by 18%'.",
        };
      }),
    };
  });

  return {
    title: customTitle,
    description: "Đề thi thử TOEIC chuẩn ETS đầy đủ 7 Parts với 200 câu hỏi mẫu phục vụ kiểm thử hệ thống.",
    type: "FULL_TEST",
    difficulty: "standard",
    totalQuestions: 200,
    listeningMinutes: 45,
    readingMinutes: 75,
    totalMinutes: 120,
    parts: [
      { partNumber: 1, name: "Phần 1: Hình ảnh", questions: part1Questions },
      { partNumber: 2, name: "Phần 2: Hỏi - Đáp", questions: part2Questions },
      { partNumber: 3, name: "Phần 3: Hội thoại", groups: part3Groups },
      { partNumber: 4, name: "Phần 4: Bài nói ngắn", groups: part4Groups },
      { partNumber: 5, name: "Phần 5: Điền câu", questions: part5Questions },
      { partNumber: 6, name: "Phần 6: Điền đoạn văn", passages: part6Passages },
      { partNumber: 7, name: "Phần 7: Đọc hiểu", passageGroups: part7Groups },
    ],
  };
}
