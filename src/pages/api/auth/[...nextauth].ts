import NextAuth, {User} from "next-auth";
import {MoralisNextAuthProvider} from "@moralisweb3/next";
import {findUserByAddress} from "@/lib/UserService";

export default NextAuth({
    providers: [MoralisNextAuthProvider()],
    callbacks: {
        async jwt({token, user}) {
            if (user) {
                token.user = await findUserByAddress(user.address as string);
                console.log(token.user);
            }
            return token;
        },
        async session({session, token}) {
            (session as any).user = token.user as User;
            return session;
        },
    },
});