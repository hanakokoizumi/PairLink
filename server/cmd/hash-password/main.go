package main

import (
	"flag"
	"fmt"
	"os"

	"golang.org/x/crypto/bcrypt"
)

const bcryptCost = 12

func main() {
	password := flag.String("password", "", "plaintext password to hash")
	flag.Parse()

	if *password == "" {
		fmt.Fprintln(os.Stderr, "Usage: hash-password --password <plaintext>")
		fmt.Fprintln(os.Stderr, "Output: $2b$12$...  (cost=12, paste into PAIRLINK_USERS)")
		os.Exit(1)
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(*password), bcryptCost)
	if err != nil {
		fmt.Fprintln(os.Stderr, "failed to hash password:", err)
		os.Exit(1)
	}
	fmt.Println(string(hash))
}
