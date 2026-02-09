import { fileURLToPath } from 'url';

// CONFIG
const TEST_NAME = "Minkova, Kira"; // We know she exists!
const AUTH_HEADER = 'Basic dGVzdDp0ZXN0';
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// IDS TO TEST
const ID_WEB_2783 = 'U2Nob29sLTI3ODM='; // School-2783 (The one from the URL)
const ID_LEGACY_4665 = 'U2Nob29sLTQ2NjU='; // School-4665 (The common API ID)

const TEACHER_QUERY = `
  query NewSearchTeachers($text: String!, $schoolID: ID!) {
    newSearch {
      teachers(query: {text: $text, schoolID: $schoolID}) {
        edges {
          node { id firstName lastName school { name id } }
        }
      }
    }
  }
`;

const GLOBAL_QUERY = `
  query NewSearchTeachers($text: String!) {
    newSearch {
      teachers(query: {text: $text}) {
        edges {
          node { id firstName lastName school { name id } }
        }
      }
    }
  }
`;

async function testStrategy(strategyName, query, variables) {
    console.log(`\n🔎 Testing ${strategyName}...`);
    try {
        const response = await fetch('https://www.ratemyprofessors.com/graphql', {
            method: 'POST',
            headers: {
                'Authorization': AUTH_HEADER,
                'Content-Type': 'application/json',
                'User-Agent': USER_AGENT // <--- CRITICAL FIX
            },
            body: JSON.stringify({ query, variables })
        });

        if (response.status !== 200) {
            console.log(`   ❌ HTTP Error: ${response.status}`);
            return;
        }

        const json = await response.json();
        const edges = json.data?.newSearch?.teachers?.edges || [];

        if (edges.length === 0) {
            console.log(`   ⚠️  Success (200 OK) but NO RESULTS found.`);
        } else {
            console.log(`   ✅ FOUND ${edges.length} RESULTS!`);
            edges.forEach(e => {
                console.log(`      - Name: ${e.node.firstName} ${e.node.lastName}`);
                console.log(`      - School: ${e.node.school.name} (ID: ${atob(e.node.school.id)})`);
            });
        }
    } catch (e) {
        console.log(`   ❌ Network Error: ${e.message}`);
    }
}

(async () => {
    console.log("🚀 STARTING RMP DIAGNOSTIC FOR: " + TEST_NAME);

    // Parse Name
    const parts = TEST_NAME.split(',');
    const lastName = parts[0].trim(); // "Minkova"
    const fullName = `${parts[1].trim()} ${parts[0].trim()}`; // "Kira Minkova"

    // TEST 1: Your ID (2783) + Last Name
    await testStrategy("Strategy 1: ID 2783 + Last Name 'Minkova'", TEACHER_QUERY, {
        text: lastName,
        schoolID: ID_WEB_2783
    });

    // TEST 2: Common ID (4665) + Last Name
    await testStrategy("Strategy 2: ID 4665 + Last Name 'Minkova'", TEACHER_QUERY, {
        text: lastName,
        schoolID: ID_LEGACY_4665
    });

    // TEST 3: Global Search + Full Name
    await testStrategy("Strategy 3: Global Search 'Kira Minkova'", GLOBAL_QUERY, {
        text: fullName
    });

})();