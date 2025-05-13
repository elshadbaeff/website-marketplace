const express = require('express');
const session = require('express-session'); // Importing express-session for session handling
const bodyParser = require('body-parser'); // Importing body-parser for parsing request bodies
const fs = require('fs'); // Importing fs for file operations
const path = require('path'); // Importing path for handling file paths
const multer = require('multer'); // Importing multer for handling file uploads
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for session handling
app.use(session({
    secret: '   Applekey-piekey-lightkey', // Change this to a secure random string
    resave: false,
    saveUninitialized: true,
    cookie: { httpOnly: true, secure: false, maxAge: 60000 } // Set to true if using HTTPS, maxAge set to 1 minute
}));

// Middleware to serve static files
app.use(express.static(path.join(__dirname))); // Serve static files from the current directory

// Middleware for parsing request bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Save files to the uploads directory
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Append timestamp to the file name
    }
});
const upload = multer({ storage: storage });

app.post('/register', (req, res) => {
    const { username, password } = req.body;
    const usersFilePath = path.join(__dirname, 'users.json');
    
    // Logic to handle user registration
    fs.readFile(usersFilePath, (err, data) => {
        if (err) {
            return res.status(500).send('Error reading user data.');
        }
        
        let users = [];
        if (data.length) {
            users = JSON.parse(data);
        }
        
        // Check if user already exists
        const userExists = users.find(user => user.username === username);
        if (userExists) {
            return res.status(400).send('User already exists.');
        }
        
        // Add new user
        users.push({ username, password, coins: 100 });
        fs.writeFile(usersFilePath, JSON.stringify(users), (err) => {
            if (err) {
                return res.status(500).send('Error saving user data.');
            }
            res.send('User registered successfully!');
        });
    });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const usersFilePath = path.join(__dirname, 'users.json');

    // Logic to handle user login
    fs.readFile(usersFilePath, (err, data) => {
        if (err) {
            return res.status(500).send('Error reading user data.');
        }

        const users = JSON.parse(data);
        const user = users.find(user => user.username === username && user.password === password);

        if (!user) {
            return res.status(401).send('Invalid username or password.');
        }

        // Store user information in session
        req.session.username = username;
        req.session.coins = user.coins; // Store user's coin balance in session

        // Generate a simple token (for demonstration purposes)
        const token = `${username}-token`;

        // Send the token back to the client
        res.json({ message: 'Login successful!', token });
    });
});

// Middleware to allow access to index.html without requiring a session
app.get('/index.html', (req, res, next) => {
    console.log('Accessing index.html');
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.use((req, res, next) => {
    // Allow access to index.html without requiring a session
    if (req.path === '/index.html' || req.path === '/') {
        return next();
    }
    if (!req.session.username && req.path !== '/get-coin-balance' && req.path !== '/items' && req.path !== '/login.html' && req.path !== '/register.html') {
        console.log('No session found, returning 403');
        return res.status(403).send('Forbidden: No session found.');
    }
    next();
});

app.get('/items', (req, res) => {
    const itemsFilePath = path.join(__dirname, 'items.json');
    
    // Logic to handle fetching items
    fs.readFile(itemsFilePath, (err, data) => {
        if (err) {
            return res.status(500).send('Error reading item data.');
        }
        
        const items = JSON.parse(data);
        res.json(items); // Send the items back to the client
    });
});

// Endpoint to get item details
app.get('/items/:id', (req, res) => {
    const itemId = req.params.id;
    const itemsFilePath = path.join(__dirname, 'items.json');

    fs.readFile(itemsFilePath, (err, data) => {
        if (err) {
            return res.status(500).send('Error reading item data.');
        }

        const items = JSON.parse(data);
        const item = items.find(item => item.id == itemId);

        if (!item) {
            return res.status(404).send('Item not found.');
        }

        res.json(item); // Send the item details back to the client
    });
});

// Change the method for getting coin balance to GET
app.get('/get-coin-balance', (req, res) => {
    const username = req.session.username;
    if (!username) {
        return res.status(403).send('Forbidden: No session found.');
    }
    const usersFilePath = path.join(__dirname, 'users.json');
    fs.readFile(usersFilePath, (err, data) => {
        if (err) {
            return res.status(500).send('Error reading user data.');
        }
        const users = JSON.parse(data);
        const user = users.find(user => user.username === username);
        res.json({ coins: user.coins }); // Send the user's coin balance
    });
});

// Endpoint to create an item with file upload
app.post('/create-item', upload.single('file'), (req, res) => {
    // Verify session
    if (!req.session.username) {
        return res.status(403).json({ error: 'You must be logged in to create an item' });
    }

    // Validate input
    const { itemName, description, price } = req.body;
    const image = req.file.path; // Get the uploaded file path
    if (!itemName || !description || !price || !image) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    // Validate price is a positive number
    if (isNaN(price) || price <= 0) {
        return res.status(400).json({ error: 'Price must be a positive number' });
    }

    const itemsFilePath = path.join(__dirname, 'items.json');
    
    try {
        // Read existing items
        let items = [];
        if (fs.existsSync(itemsFilePath)) {
            const data = fs.readFileSync(itemsFilePath, 'utf8');
            if (data) {
                items = JSON.parse(data);
            }
        }

        // Add new item with additional metadata
        const newItem = {
            id: Date.now(), // Unique ID
            itemName,
            description,
            price: Number(price),
            image,
            file: req.file.filename, // Store the uploaded file name
            createdBy: req.session.username,
            createdAt: new Date().toISOString()
        };
        
        items.push(newItem);

        // Write updated items
        fs.writeFileSync(itemsFilePath, JSON.stringify(items, null, 2));
        
        res.status(201).json({
            message: 'Item created successfully!',
            item: newItem
        });
    } catch (err) {
        console.error('Error creating item:', err);
        res.status(500).json({ error: 'Failed to create item' });
    }
});

// Endpoint to buy an item
app.post('/buy-item', (req, res) => {
    const { itemId } = req.body;
    const username = req.session.username;

    if (!username) {
        return res.status(403).send('Forbidden: No session found.');
    }

    const itemsFilePath = path.join(__dirname, 'items.json');
    const usersFilePath = path.join(__dirname, 'users.json');

    fs.readFile(itemsFilePath, (err, data) => {
        if (err) {
            return res.status(500).send('Error reading item data.');
        }

        const items = JSON.parse(data);
        const item = items.find(item => item.id == itemId);

        if (!item) {
            return res.status(404).send('Item not found.');
        }

        // Check if the user has enough coins
        fs.readFile(usersFilePath, (err, userData) => {
            if (err) {
                return res.status(500).send('Error reading user data.');
            }

            const users = JSON.parse(userData);
            const user = users.find(user => user.username === username);

            if (user.coins < item.price) {
                return res.status(400).send('Insufficient coins.');
            }

            // Deduct coins from buyer and add to seller
            user.coins -= item.price;
            const seller = users.find(user => user.username === item.createdBy);
            seller.coins += item.price;

            // Update users.json
            fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));

            res.send('Item purchased successfully!');
        });
    });
});

// Endpoint to delete an item
app.post('/delete-item', (req, res) => {
    const { itemId } = req.body;
    const username = req.session.username;

    if (!username) {
        return res.status(403).send('Forbidden: No session found.');
    }

    const itemsFilePath = path.join(__dirname, 'items.json');

    fs.readFile(itemsFilePath, (err, data) => {
        if (err) {
            return res.status(500).send('Error reading item data.');
        }

        let items = JSON.parse(data);
        const itemIndex = items.findIndex(item => item.id == itemId && item.createdBy === username);

        if (itemIndex === -1) {
            return res.status(404).send('Item not found or you are not the owner.');
        }

        // Remove the item from the array
        items.splice(itemIndex, 1);

        // Write updated items
        fs.writeFileSync(itemsFilePath, JSON.stringify(items, null, 2));

        res.send('Item deleted successfully!');
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
