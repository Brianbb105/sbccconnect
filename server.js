const express = require('express');
const ratings = require('@mtucourses/rate-my-professors').default;
const cors = require('cors');

const app = express();
app.use(cors()); // Allows your frontend to talk to this server

// Endpoint: /professor?name=Stephen Strenn&school=Santa Barbara City College
app.get('/professor', async (req, res) => {
    const { name, school } = req.query;

    if (!name || !school) {
        return res.status(400).json({ error: "Please provide 'name' and 'school' parameters." });
    }

    try {
        // 1. Find the School ID
        const schools = await ratings.searchSchool(school);
        if (schools.length === 0) {
            return res.status(404).json({ error: "School not found." });
        }
        const schoolID = schools[0].id;

        // 2. Find the Professor
        const professors = await ratings.searchTeacher(name, schoolID);
        if (professors.length === 0) {
            return res.status(404).json({ error: "Professor not found." });
        }

        // 3. Get Full Details
        const profDetails = await ratings.getTeacher(professors[0].id);
        res.json(profDetails);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Something went wrong fetching data." });
    }
});

app.listen(3000, () => {
    console.log('✅ RMP API is running on http://localhost:3000');
});