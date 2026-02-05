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

async function verifyV16() {
    try {
        console.log('=== V1.6 VERIFICATION SCRIPT ===\\n');

        // 1. Register mentor
        console.log('1. Registering Mentor...');
        const mentor = await request('/auth/register', 'POST', {
            name: 'V16 Mentor',
            username: `v16_mentor_${Date.now()}`,
            email: `v16_mentor_${Date.now()}@test.com`,
            password: 'password123',
            role: 'mentor'
        });
        console.log('✅ Mentor:', mentor.username);

        // 2. Register student
        console.log('\\n2. Registering Student...');
        const student = await request('/auth/register', 'POST', {
            name: 'V16 Student',
            username: `v16_student_${Date.now()}`,
            email: `v16_student_${Date.now()}@test.com`,
            password: 'password123',
            role: 'student'
        });
        console.log('✅ Student:', student.username);

        // 3. Student sends mentorship request
        console.log('\\n3. Sending Mentorship Request...');
        const requestData = await request('/requests', 'POST', {
            receiverId: mentor._id,
            type: 'mentorship',
            message: 'Please mentor me!',
            pitch: { q_0: 'React + Node', q_1: 'Junior', q_2: ['Web', 'Mobile'] },
            isPublic: false
        }, student.token);
        console.log('✅ Request sent');

        // 4. Mentor accepts request (should trigger inbox notification)
        console.log('\\n4. Mentor Accepting Request...');
        await request(`/requests/${requestData._id}/respond`, 'PUT', { status: 'accepted' }, mentor.token);
        console.log('✅ Request accepted');

        // 5. Check student inbox for notification
        console.log('\\n5. Checking Student Inbox...');
        const studentInbox = await request('/requests/received', 'GET', null, student.token);
        const notification = studentInbox.find(r => r.type === 'notification' && r.message.includes('accepted'));
        if (notification) {
            console.log('✅ Inbox notification received:', notification.message);
        } else {
            console.log('❌ No notification found in inbox');
        }

        // 6. Mentor creates plan
        console.log('\\n6. Creating Mentorship Plan...');
        const plan = await request('/plans', 'POST', {
            menteeId: student._id,
            title: 'Week 1: Setting Up Your Dev Environment',
            content: '# Getting Started\\n\\n**Goals:**\\n- Install Node.js\\n- Set up VS Code\\n- Create first React app\\n\\n*Let me know if you have questions!*'
        }, mentor.token);
        console.log('✅ Plan created (v0.0)');

        // 7. Mentor adds a new version
        console.log('\\n7. Adding New Version...');
        const updatedPlan = await request(`/plans/${plan._id}/version`, 'PUT', {
            title: 'Week 2: Learning React Fundamentals',
            content: '# React Basics\\n\\n- Components\\n- Props\\n- State\\n- Hooks',
            isMajor: false
        }, mentor.token);
        console.log(`✅ New version added (v0.1)`);

        // 8. Student views plan
        console.log('\\n8. Student Fetching Plan...');
        const studentPlan = await request(`/plans/${plan._id}`, 'GET', null, student.token);
        console.log(`✅ Student can view plan with ${studentPlan.versions.length} versions`);

        // 9. Student adds comment
        console.log('\\n9. Student Adding Comment...');
        await request(`/plans/${plan._id}/version/0/comment`, 'POST', {
            text: 'I finished installing everything! What should I do next?'
        }, student.token);
        console.log('✅ Comment added to version 0');

        // 10. Mentor replies
        console.log('\\n10. Mentor Replying...');
        await request(`/plans/${plan._id}/version/0/comment`, 'POST', {
            text: 'Great job! Now try building a simple counter app.'
        }, mentor.token);
        console.log('✅ Mentor replied');

        // 11. Verify final state
        console.log('\\n11. Final Verification...');
        const finalPlan = await request(`/plans/${plan._id}`, 'GET', null, mentor.token);
        const v0 = finalPlan.versions[0];
        if (v0.comments.length === 2) {
            console.log(`✅ Version 0 has ${v0.comments.length} comments`);
        } else {
            console.log(`❌ Expected 2 comments, found ${v0.comments.length}`);
        }

        console.log('\\n=== ALL TESTS PASSED ✅ ===');

    } catch (error) {
        console.error('\\n❌ TEST FAILED:', error.message);
    }
}

verifyV16();
