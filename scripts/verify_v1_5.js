const API_URL = 'http://localhost:5000/api';

async function request(endpoint, method = 'GET', body = null, token = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(`${API_URL}${endpoint}`, options);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || res.statusText);
    return data;
}

async function verifyPitchFlow() {
    try {
        console.log('1. Registering Mentor...');
        const mentor = await request('/auth/register', 'POST', {
            name: 'Verification Mentor',
            username: `ver_mentor_${Date.now()}`,
            email: `ver_mentor_${Date.now()}@test.com`,
            password: 'password123',
            role: 'mentor'
        });
        console.log('Mentor Registered:', mentor.username);

        console.log('2. Updating Mentor Pitch Questions...');
        const pitchQuestions = [
            { questionType: 'text', questionText: 'What is your stack?' },
            { questionType: 'mcq', questionText: 'Experience Level?', options: ['Junior', 'Mid', 'Senior'] },
            { questionType: 'checkbox', questionText: 'Interests?', options: ['AI', 'Web', 'Mobile'] }
        ];

        await request('/users/profile', 'PUT', { pitchQuestions }, mentor.token);
        console.log('Pitch Questions Updated.');

        console.log('3. Fetching Mentor Profile to Verify...');
        const fetchedMentor = await request(`/users/${mentor._id}`);
        if (fetchedMentor.pitchQuestions && fetchedMentor.pitchQuestions.length === 3) {
            console.log('✅ Pitch Questions Verified in DB.');
        } else {
            console.error('❌ Pitch Questions Mismatch.');
            return;
        }

        console.log('4. Registering Student...');
        const student = await request('/auth/register', 'POST', {
            name: 'Verification Student',
            username: `ver_student_${Date.now()}`,
            email: `ver_student_${Date.now()}@test.com`,
            password: 'password123',
            role: 'student'
        });
        console.log('Student Registered:', student.username);

        console.log('5. Sending Mentorship Request with Custom Answers...');
        const pitchAnswers = {
            'q_0': 'MERN Stack', // Text
            'q_1': 'Junior',     // MCQ
            'q_2': ['AI', 'Web'] // Checkbox (Array)
        };

        const requestData = await request('/requests', 'POST', {
            receiverId: mentor._id,
            type: 'mentorship',
            message: 'Looking for guidance',
            pitch: pitchAnswers,
            isPublic: false
        }, student.token);
        console.log('Request Sent.');

        console.log('6. Verifying Request Data...');
        const requestsData = await request('/requests/received', 'GET', null, mentor.token);

        const myRequest = requestsData.find(r => r._id === requestData._id);

        if (myRequest && myRequest.pitch['q_2'].includes('AI')) {
            console.log('✅ Request Payload Verified (Mixed Types Supported).');
        } else {
            console.error('❌ Request Payload Verification Failed.');
            console.log(myRequest?.pitch);
        }

    } catch (error) {
        console.error('Test Failed:', error.message);
    }
}

verifyPitchFlow();
